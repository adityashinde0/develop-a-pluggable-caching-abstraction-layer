"""Unit and integration tests for MetricsCollector and Observability (Phase 2)."""

from unittest.mock import MagicMock
import pytest
from starlette.testclient import TestClient

from cache_layer.adapters.memcached_adapter import MemcachedAdapter
from cache_layer.adapters.redis_adapter import RedisAdapter
from cache_layer.api import app, set_cache_service
from cache_layer.metrics import MetricsCollector
from cache_layer.service import CacheService


def test_metrics_collector_calculations():
    collector = MetricsCollector()

    # Empty snapshot
    snap = collector.get_snapshot()
    assert snap["request_count"] == 0
    assert snap["hit_ratio"] == 0.0
    assert snap["average_latency_ms"] == 0.0
    assert snap["p50_latency_ms"] == 0.0
    assert snap["p95_latency_ms"] == 0.0

    # Record 8 hits and 2 misses (hit ratio = 0.8)
    for _ in range(8):
        collector.record_get(hit=True, latency_ms=1.0)
    for _ in range(2):
        collector.record_get(hit=False, latency_ms=2.0)

    # Record 5 sets and 1 delete
    for _ in range(5):
        collector.record_set(latency_ms=1.5)
    collector.record_delete(latency_ms=0.5)

    snap = collector.get_snapshot()
    assert snap["request_count"] == 16
    assert snap["cache_hits"] == 8
    assert snap["cache_misses"] == 2
    assert snap["hit_ratio"] == 0.8
    assert snap["sets"] == 5
    assert snap["deletes"] == 1
    assert snap["errors"] == 0
    assert snap["sample_size"] == 16
    assert snap["average_latency_ms"] > 0
    assert snap["p50_latency_ms"] > 0
    assert snap["p95_latency_ms"] >= snap["p50_latency_ms"]

    # Reset
    collector.reset()
    snap_after = collector.get_snapshot()
    assert snap_after["request_count"] == 0
    assert snap_after["cache_hits"] == 0
    assert snap_after["sample_size"] == 0


def test_cache_service_metrics_tracking():
    mock_client = MagicMock()
    store = {}
    mock_client.get.side_effect = lambda k: store.get(k)
    mock_client.set.side_effect = lambda k, v, **kw: store.update({k: v}) or True
    mock_client.delete.side_effect = lambda k: store.pop(k, None) is not None or True

    adapter = RedisAdapter(client=mock_client)
    service = CacheService(provider=adapter, namespace="metric_test")

    # 1. Miss
    service.get("item_1")
    # 2. Set
    service.set("item_1", {"name": "Test"})
    # 3. Hit
    service.get("item_1")
    # 4. Delete
    service.delete("item_1")

    metrics = service.get_metrics()
    assert metrics["active_provider"] == "redis"
    assert metrics["namespace"] == "metric_test"
    assert metrics["cache_hits"] == 1
    assert metrics["cache_misses"] == 1
    assert metrics["hit_ratio"] == 0.5
    assert metrics["sets"] == 1
    assert metrics["deletes"] == 1
    assert metrics["request_count"] == 4
    assert metrics["p50_latency_ms"] >= 0.0
    assert metrics["p95_latency_ms"] >= 0.0

    service.reset_metrics()
    assert service.get_metrics()["request_count"] == 0


def test_api_metrics_endpoints():
    mock_client = MagicMock()
    mock_client.get.return_value = None
    mock_client.set.return_value = True

    adapter = MemcachedAdapter(client=mock_client)
    service = CacheService(provider=adapter, namespace="api_metrics")
    set_cache_service(service)
    client = TestClient(app)

    # Trigger some operations
    client.get("/cache/key1")  # Miss
    client.put("/cache/key1", json={"value": 123})  # Set

    # GET /cache/metrics
    resp = client.get("/cache/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_provider"] == "memcached"
    assert data["cache_misses"] == 1
    assert data["sets"] == 1
    assert "average_latency_ms" in data
    assert "p50_latency_ms" in data
    assert "p95_latency_ms" in data

    # POST /cache/metrics/reset
    resp_reset = client.post("/cache/metrics/reset")
    assert resp_reset.status_code == 200
    assert resp_reset.json()["status"] == "metrics_reset"

    # Verify reset
    resp_after = client.get("/cache/metrics")
    assert resp_after.json()["request_count"] == 0
