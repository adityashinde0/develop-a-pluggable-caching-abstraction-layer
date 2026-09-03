"""E-Commerce Product Catalog Service utilizing the Pluggable Caching Abstraction Layer.

Demonstrates the Cache-Aside pattern on a realistic business use case:
1. Product retrieval checks cache first (Cache HIT -> immediate return < 2ms).
2. On cache miss, loads from database with simulated I/O delay (Cache MISS -> ~100ms) and populates cache.
3. Product update updates database and invalidates cache entry.

Zero imports of backend-specific libraries (redis / pymemcache) in this business layer.
"""

import time
from typing import Any, Dict, Optional

from cache_layer import CacheService, CacheValidationError

# Simulated database records
SEED_PRODUCTS: Dict[str, Dict[str, Any]] = {
    "prod_101": {
        "id": "prod_101",
        "name": "Ultra HD 4K Monitor 27-inch",
        "category": "Electronics",
        "price": 349.99,
        "currency": "USD",
        "stock": 45,
        "rating": 4.8,
        "tags": ["display", "4k", "ips", "hdr"],
    },
    "prod_102": {
        "id": "prod_102",
        "name": "Wireless Ergonomic Mechanical Keyboard",
        "category": "Peripherals",
        "price": 129.50,
        "currency": "USD",
        "stock": 120,
        "rating": 4.9,
        "tags": ["keyboard", "wireless", "mechanical", "rgb"],
    },
    "prod_103": {
        "id": "prod_103",
        "name": "Active Noise Cancelling Wireless Headphones",
        "category": "Audio",
        "price": 249.00,
        "currency": "USD",
        "stock": 30,
        "rating": 4.7,
        "tags": ["audio", "anc", "bluetooth", "hifi"],
    },
}

SIMULATED_DB_LATENCY_SECONDS = 0.100  # 100ms simulated database query delay


class ProductCatalogService:
    """E-commerce product catalog business service with transparent caching."""

    # Simulated shared persistent database store
    _database_store: Dict[str, Dict[str, Any]] = {k: dict(v) for k, v in SEED_PRODUCTS.items()}

    def __init__(self, cache_service: CacheService, default_ttl: int = 300):
        self._cache = cache_service
        self._default_ttl = default_ttl
        self._db_query_count = 0

    @classmethod
    def reset_database(cls) -> None:
        """Reset simulated database to seed state."""
        cls._database_store = {k: dict(v) for k, v in SEED_PRODUCTS.items()}

    @property
    def db_query_count(self) -> int:
        """Total number of times the slow backend database was queried."""
        return self._db_query_count

    @property
    def cache(self) -> CacheService:
        """The underlying pluggable cache service."""
        return self._cache

    def _cache_key(self, product_id: str) -> str:
        return f"product:{product_id}"

    def get_product(self, product_id: str, simulate_delay: bool = True) -> Optional[Dict[str, Any]]:
        """Retrieve a product by ID using the Cache-Aside pattern.

        Returns:
            Product data dictionary with metadata ('_source': 'cache' | 'database', '_latency_ms': float).
        """
        start_time = time.perf_counter()
        cache_key = self._cache_key(product_id)

        # 1. Check cache first
        cached_data = self._cache.get(cache_key)
        if cached_data is not None:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            result = dict(cached_data)
            result["_source"] = "cache"
            result["_latency_ms"] = round(latency_ms, 3)
            result["_provider"] = self._cache.provider_name
            return result

        # 2. Cache MISS -> Fetch from slow database
        if simulate_delay:
            time.sleep(SIMULATED_DB_LATENCY_SECONDS)

        self._db_query_count += 1
        raw_product = self._database_store.get(product_id)
        if raw_product is None:
            return None

        product_copy = dict(raw_product)

        # 3. Store in cache for subsequent reads
        self._cache.set(cache_key, product_copy, ttl=self._default_ttl)

        latency_ms = (time.perf_counter() - start_time) * 1000.0
        product_copy["_source"] = "database"
        product_copy["_latency_ms"] = round(latency_ms, 3)
        product_copy["_provider"] = self._cache.provider_name
        return product_copy

    def update_product_price(self, product_id: str, new_price: float) -> bool:
        """Update product price in the database and invalidate cached entry."""
        if product_id not in self._database_store:
            return False

        self._database_store[product_id]["price"] = float(new_price)
        # Invalidate cache
        cache_key = self._cache_key(product_id)
        self._cache.delete(cache_key)
        return True
