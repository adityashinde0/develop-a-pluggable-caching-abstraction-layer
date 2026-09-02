"""Unit and integration tests for Real-World E-Commerce Caching (Phase 1)."""

from unittest.mock import MagicMock
import pytest
from starlette.testclient import TestClient

from cache_layer.adapters.memcached_adapter import MemcachedAdapter
from cache_layer.adapters.redis_adapter import RedisAdapter
from cache_layer.api import app, set_cache_service
from cache_layer.service import CacheService
from examples.ecommerce_service import ProductCatalogService


def create_simulated_adapter(adapter_cls):
    mock_client = MagicMock()
    store = {}

    mock_client.get.side_effect = lambda k: store.get(k)
    mock_client.set.side_effect = lambda k, v, **kw: store.update({k: v}) or True
    mock_client.delete.side_effect = lambda k: store.pop(k, None) is not None or True
    mock_client.flushdb.side_effect = lambda: store.clear() or True
    mock_client.flush_all.side_effect = lambda: store.clear() or True
    mock_client.ping.return_value = True
    mock_client.stats.return_value = {b"version": b"1.6.9"}

    return adapter_cls(client=mock_client)


@pytest.mark.parametrize("adapter_cls", [RedisAdapter, MemcachedAdapter], ids=["Redis", "Memcached"])
def test_ecommerce_cache_aside_flow(adapter_cls):
    adapter = create_simulated_adapter(adapter_cls)
    cache_service = CacheService(provider=adapter, namespace="ecommerce_test")
    catalog = ProductCatalogService(cache_service=cache_service, default_ttl=60)

    # 1. First read -> Cache MISS (hits simulated database)
    prod_1st = catalog.get_product("prod_101", simulate_delay=False)
    assert prod_1st is not None
    assert prod_1st["id"] == "prod_101"
    assert prod_1st["_source"] == "database"
    assert catalog.db_query_count == 1

    # 2. Second read -> Cache HIT (does not hit database)
    prod_2nd = catalog.get_product("prod_101", simulate_delay=False)
    assert prod_2nd is not None
    assert prod_2nd["id"] == "prod_101"
    assert prod_2nd["_source"] == "cache"
    assert catalog.db_query_count == 1  # Query count unchanged!

    # 3. Update price -> Invalidation
    assert catalog.update_product_price("prod_101", 399.99) is True

    # 4. Third read -> Cache MISS (re-fetches new price from database)
    prod_3rd = catalog.get_product("prod_101", simulate_delay=False)
    assert prod_3rd is not None
    assert prod_3rd["price"] == 399.99
    assert prod_3rd["_source"] == "database"
    assert catalog.db_query_count == 2  # Query count incremented after invalidation

    # 5. Non-existent product -> None
    assert catalog.get_product("prod_999", simulate_delay=False) is None


def test_ecommerce_api_endpoints():
    mock_adapter = create_simulated_adapter(RedisAdapter)
    cache_service = CacheService(provider=mock_adapter, namespace="api_ecom_test")
    set_cache_service(cache_service)
    client = TestClient(app)

    # 1. First GET request -> MISS
    resp1 = client.get("/products/prod_102")
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["id"] == "prod_102"
    assert data1["_source"] == "database"

    # 2. Second GET request -> HIT
    resp2 = client.get("/products/prod_102")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["id"] == "prod_102"
    assert data2["_source"] == "cache"

    # 3. PUT Price update -> Invalidate cache
    resp_update = client.put("/products/prod_102/price", json={"price": 149.99})
    assert resp_update.status_code == 200
    assert resp_update.json()["cache_invalidated"] is True

    # 4. GET after update -> reloads with updated price
    resp3 = client.get("/products/prod_102")
    assert resp3.status_code == 200
    data3 = resp3.json()
    assert data3["price"] == 149.99
    assert data3["_source"] == "database"

    # 5. Non-existent product -> 404
    resp_404 = client.get("/products/prod_nonexistent")
    assert resp_404.status_code == 404
