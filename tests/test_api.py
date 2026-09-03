"""Unit and integration tests for FastAPI caching endpoints."""

from unittest.mock import MagicMock
import pytest
from starlette.testclient import TestClient

from cache_layer.adapters.memcached_adapter import MemcachedAdapter
from cache_layer.adapters.redis_adapter import RedisAdapter
from cache_layer.api import app, set_cache_service
from cache_layer.exceptions import CacheConnectionError
from cache_layer.service import CacheService


@pytest.fixture(autouse=True)
def setup_mock_service():
    mock_store = {}
    mock_redis = MagicMock()
    mock_redis.get.side_effect = lambda k: mock_store.get(k)
    mock_redis.set.side_effect = lambda k, v, **kw: mock_store.update({k: v}) or True
    mock_redis.delete.side_effect = lambda *keys: [mock_store.pop(k, None) for k in keys] or True
    mock_redis.exists.side_effect = lambda k: 1 if k in mock_store else 0
    mock_redis.scan_iter.side_effect = lambda match=None, count=None: [
        k for k in list(mock_store.keys()) if match is None or k.startswith(match.replace("*", ""))
    ]
    mock_redis.flushdb.side_effect = lambda: mock_store.clear() or True
    mock_redis.ping.return_value = True

    adapter = RedisAdapter(client=mock_redis)
    service = CacheService(provider=adapter, namespace="api_test")
    set_cache_service(service)
    yield
    service.close()


def test_api_health_and_info():
    client = TestClient(app)

    # Health
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["provider"] == "redis"

    # Info
    resp = client.get("/cache/info")
    assert resp.status_code == 200
    data = resp.json()
    assert data["provider"] == "redis"
    assert data["namespace"] == "api_test"


def test_api_crud_flow():
    client = TestClient(app)

    # 404 on miss
    resp = client.get("/cache/nonexistent")
    assert resp.status_code == 404

    # PUT
    payload = {"value": {"user_id": 42, "role": "admin"}, "ttl": 60}
    resp = client.put("/cache/user_42", json=payload)
    assert resp.status_code == 200
    assert resp.json()["stored"] is True

    # GET hit
    resp = client.get("/cache/user_42")
    assert resp.status_code == 200
    data = resp.json()
    assert data["cached"] is True
    assert data["value"] == {"user_id": 42, "role": "admin"}

    # DELETE single key
    resp = client.delete("/cache/user_42")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True

    # GET after delete
    resp = client.get("/cache/user_42")
    assert resp.status_code == 404


def test_api_cached_none():
    client = TestClient(app)

    # 1. Store None
    resp_put = client.put("/cache/key_with_none", json={"value": None})
    assert resp_put.status_code == 200
    assert resp_put.json()["stored"] is True

    # 2. Retrieve None -> Must be HTTP 200 (HIT with null), NOT 404!
    resp_get = client.get("/cache/key_with_none")
    assert resp_get.status_code == 200
    data = resp_get.json()
    assert data["cached"] is True
    assert data["value"] is None

    # 3. Delete key
    client.delete("/cache/key_with_none")

    # 4. Retrieve after delete -> Must be HTTP 404
    assert client.get("/cache/key_with_none").status_code == 404


def test_api_clear():
    client = TestClient(app)
    client.put("/cache/k1", json={"value": "v1"})
    client.put("/cache/k2", json={"value": "v2"})

    resp = client.delete("/cache")
    assert resp.status_code == 200
    assert resp.json()["cleared"] is True

    assert client.get("/cache/k1").status_code == 404
    assert client.get("/cache/k2").status_code == 404


def test_api_validation_error():
    client = TestClient(app)
    # Key with whitespace
    resp = client.get("/cache/bad key with spaces")
    assert resp.status_code == 422
    assert "ValidationError" in resp.json()["error"]


def test_api_switch_backend():
    client = TestClient(app)

    mock_mc = MagicMock()
    mock_mc.stats.return_value = {b"version": b"1.6.9"}
    mock_mc_adapter = MemcachedAdapter(client=mock_mc)
    mc_service = CacheService(provider=mock_mc_adapter, namespace="switched_ns")

    # Switch to Memcached service directly
    set_cache_service(mc_service)

    resp = client.get("/cache/info")
    assert resp.status_code == 200
    assert resp.json()["provider"] == "memcached"
    assert resp.json()["namespace"] == "switched_ns"
