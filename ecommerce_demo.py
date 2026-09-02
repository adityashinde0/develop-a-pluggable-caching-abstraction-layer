"""Real-World E-Commerce API Caching Demonstration (Phase 1).

Demonstrates:
1. Cache MISS on initial request (simulated DB latency ~100ms).
2. Cache SET transparently in CacheService.
3. Cache HIT on subsequent request (<2ms, ~50x - 100x latency reduction).
4. Switching from Redis to Memcached with ZERO business logic changes.
5. Identical Cache MISS -> Cache HIT acceleration on Memcached.
"""

import sys
import time
from typing import Any
from unittest.mock import MagicMock

from cache_layer.adapters.memcached_adapter import MemcachedAdapter
from cache_layer.adapters.redis_adapter import RedisAdapter
from cache_layer.factory import ProviderFactory
from cache_layer.service import CacheService
from examples.ecommerce_service import ProductCatalogService


def create_simulated_backend(name: str):
    """Create in-memory adapter for standalone demonstration."""
    mock_client = MagicMock()
    store = {}

    mock_client.get.side_effect = lambda k: store.get(k)
    mock_client.set.side_effect = lambda k, v, **kw: store.update({k: v}) or True
    mock_client.delete.side_effect = lambda k: store.pop(k, None) is not None or True
    mock_client.flushdb.side_effect = lambda: store.clear() or True
    mock_client.flush_all.side_effect = lambda: store.clear() or True
    mock_client.ping.return_value = True
    mock_client.stats.return_value = {b"version": b"1.6.9"}

    if name == "redis":
        return RedisAdapter(client=mock_client)
    else:
        return MemcachedAdapter(client=mock_client)


def print_banner(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_step(step_num: int, title: str):
    print(f"\n[Step {step_num}] {title}")
    print("-" * 50)


def run_ecommerce_demo(use_live: bool = False):
    print_banner("REAL-WORLD USE CASE: E-COMMERCE PRODUCT CATALOG CACHING")
    print("Demonstrating Cache-Aside pattern & provider interchangeability.")

    # -------------------------------------------------------------
    # 1. REDIS BACKEND
    # -------------------------------------------------------------
    print_step(1, "Initializing E-Commerce Catalog with REDIS Backend")
    if use_live:
        redis_provider = ProviderFactory.create_provider({"backend": "redis"})
    else:
        redis_provider = create_simulated_backend("redis")

    redis_cache = CacheService(provider=redis_provider, namespace="shop_redis")
    catalog_redis = ProductCatalogService(redis_cache)

    print(f"  > Active Provider: [{redis_cache.provider_name.upper()}]")
    print("  > Querying product 'prod_101' for the first time (Cold Cache)...")

    p1 = catalog_redis.get_product("prod_101", simulate_delay=True)
    print(f"    - Source:       [{p1['_source'].upper()}]")
    print(f"    - Product Name: {p1['name']}")
    print(f"    - Price:        ${p1['price']:.2f}")
    print(f"    - Latency:      {p1['_latency_ms']:.2f} ms")
    print(f"    - DB Queries:   {catalog_redis.db_query_count}")

    print("\n  > Querying product 'prod_101' again (Warm Cache)...")
    p2 = catalog_redis.get_product("prod_101", simulate_delay=True)
    print(f"    - Source:       [{p2['_source'].upper()}]")
    print(f"    - Product Name: {p2['name']}")
    print(f"    - Latency:      {p2['_latency_ms']:.2f} ms")
    print(f"    - DB Queries:   {catalog_redis.db_query_count} (No additional DB load!)")

    speedup_redis = p1["_latency_ms"] / max(p2["_latency_ms"], 0.01)
    print(f"  > Speedup with Redis: {speedup_redis:.1f}x faster response")

    # -------------------------------------------------------------
    # 2. CONFIGURATION SWITCH TO MEMCACHED
    # -------------------------------------------------------------
    print_step(2, "Switching Configuration: CACHE_BACKEND = 'memcached'")
    print("  Notice: ProductCatalogService business logic has ZERO code changes!")

    if use_live:
        memcached_provider = ProviderFactory.create_provider({"backend": "memcached"})
    else:
        memcached_provider = create_simulated_backend("memcached")

    memcached_cache = CacheService(provider=memcached_provider, namespace="shop_memcached")
    catalog_memcached = ProductCatalogService(memcached_cache)

    print(f"  > Active Provider: [{memcached_cache.provider_name.upper()}]")
    print("  > Querying product 'prod_102' for the first time (Cold Cache)...")

    m1 = catalog_memcached.get_product("prod_102", simulate_delay=True)
    print(f"    - Source:       [{m1['_source'].upper()}]")
    print(f"    - Product Name: {m1['name']}")
    print(f"    - Latency:      {m1['_latency_ms']:.2f} ms")
    print(f"    - DB Queries:   {catalog_memcached.db_query_count}")

    print("\n  > Querying product 'prod_102' again (Warm Cache)...")
    m2 = catalog_memcached.get_product("prod_102", simulate_delay=True)
    print(f"    - Source:       [{m2['_source'].upper()}]")
    print(f"    - Product Name: {m2['name']}")
    print(f"    - Latency:      {m2['_latency_ms']:.2f} ms")
    print(f"    - DB Queries:   {catalog_memcached.db_query_count} (No additional DB load!)")

    speedup_mc = m1["_latency_ms"] / max(m2["_latency_ms"], 0.01)
    print(f"  > Speedup with Memcached: {speedup_mc:.1f}x faster response")

    # -------------------------------------------------------------
    # 3. CACHE INVALIDATION UPON DATA MUTATION
    # -------------------------------------------------------------
    print_step(3, "Demonstrating Price Update & Cache Invalidation")
    print("  > Updating 'prod_102' price from $129.50 to $99.99 (Special Sale)...")
    catalog_memcached.update_product_price("prod_102", 99.99)

    print("  > Reading product after price update (Cache Invalidation forces fresh DB read)...")
    m3 = catalog_memcached.get_product("prod_102", simulate_delay=True)
    print(f"    - Source:       [{m3['_source'].upper()}]")
    print(f"    - Product Name: {m3['name']}")
    print(f"    - New Price:    ${m3['price']:.2f}")
    print(f"    - Latency:      {m3['_latency_ms']:.2f} ms")
    print(f"    - DB Queries:   {catalog_memcached.db_query_count}")

    # Cleanup
    redis_cache.close()
    memcached_cache.close()

    print_banner("PHASE 1 REAL-WORLD DEMO COMPLETED SUCCESSFULLY")


if __name__ == "__main__":
    live_mode = "--live" in sys.argv
    run_ecommerce_demo(use_live=live_mode)
