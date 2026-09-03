"""Real backend integration tests for Redis and Memcached.

These tests run against real, active Redis and Memcached services.
If a live service is not reachable on its configured host/port, the test is
gracefully skipped with a clear diagnostic reason.
"""

import os
import socket
import time
import pytest

from cache_layer.adapters.memcached_adapter import MemcachedAdapter
from cache_layer.adapters.redis_adapter import RedisAdapter
from cache_layer.config import CacheConfig, MemcachedConfig, RedisConfig
from cache_layer.exceptions import CacheConnectionError, CacheError, CacheTimeoutError
from cache_layer.factory import ProviderFactory
from cache_layer.service import CacheService


def is_port_open(host: str, port: int, timeout: float = 0.5) -> bool:
    """Check whether a TCP socket port is open and accepting connections."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        s.connect((host, port))
        s.close()
        return True
    except Exception:
        return False


REDIS_HOST = os.environ.get("REDIS_HOST", "127.0.0.1")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
MEMCACHED_HOST = os.environ.get("MEMCACHED_HOST", "127.0.0.1")
MEMCACHED_PORT = int(os.environ.get("MEMCACHED_PORT", "11211"))

redis_available = is_port_open(REDIS_HOST, REDIS_PORT)
memcached_available = is_port_open(MEMCACHED_HOST, MEMCACHED_PORT)


@pytest.mark.integration
@pytest.mark.skipif(not redis_available, reason=f"Real Redis server not running at {REDIS_HOST}:{REDIS_PORT}")
def test_real_redis_integration_lifecycle():
    """Full lifecycle integration test against active Redis server."""
    adapter = RedisAdapter(host=REDIS_HOST, port=REDIS_PORT, db=15)
    service_a = CacheService(provider=adapter, namespace="integ_redis_a")
    service_b = CacheService(provider=adapter, namespace="integ_redis_b")

    try:
        # 1. Health check
        health = service_a.health_check()
        assert health["status"] == "healthy"
        assert health["provider"] == "redis"
        assert health["latency_ms"] >= 0.0

        # 2. Basic CRUD & Type Preservation
        assert service_a.set("str_val", "Redis Integration") is True
        assert service_a.get("str_val") == "Redis Integration"

        assert service_a.set("int_val", 42) is True
        assert service_a.get("int_val") == 42
        assert type(service_a.get("int_val")) is int

        assert service_a.set("bool_val", True) is True
        assert service_a.get("bool_val") is True
        assert type(service_a.get("bool_val")) is bool

        nested_doc = {"id": 101, "tags": ["db", "cache"], "config": {"active": True, "weight": 4.5}}
        assert service_a.set("json_doc", nested_doc) is True
        assert service_a.get("json_doc") == nested_doc

        raw_bytes = b"\x01\x02\x03\x04\xff binary payload"
        assert service_a.set("bytes_val", raw_bytes) is True
        assert service_a.get("bytes_val") == raw_bytes

        # 3. Cached None vs Miss
        assert service_a.get("unassigned_key") is None
        assert service_a.exists("unassigned_key") is False

        assert service_a.set("none_key", None) is True
        assert service_a.exists("none_key") is True
        is_hit, val = service_a.get_with_status("none_key")
        assert is_hit is True
        assert val is None

        # 4. TTL Expiration (1 second)
        assert service_a.set("ttl_key", "expiring_soon", ttl=1) is True
        assert service_a.get("ttl_key") == "expiring_soon"
        time.sleep(1.2)
        assert service_a.get("ttl_key") is None
        assert service_a.exists("ttl_key") is False

        # 5. Namespace-Safe Clear
        service_b.set("shared_id", "Beta Data Preserved")
        service_a.set("shared_id", "Alpha Data To Delete")

        assert service_a.clear() is True

        assert service_a.get("shared_id") is None
        assert service_b.get("shared_id") == "Beta Data Preserved"

        # Clean up
        service_b.clear()
    finally:
        service_a.close()


@pytest.mark.integration
@pytest.mark.skipif(not memcached_available, reason=f"Real Memcached server not running at {MEMCACHED_HOST}:{MEMCACHED_PORT}")
def test_real_memcached_integration_lifecycle():
    """Full lifecycle integration test against active Memcached server."""
    adapter = MemcachedAdapter(host=MEMCACHED_HOST, port=MEMCACHED_PORT)
    service_a = CacheService(provider=adapter, namespace="integ_mc_a")
    service_b = CacheService(provider=adapter, namespace="integ_mc_b")

    try:
        # 1. Health check
        health = service_a.health_check()
        assert health["status"] == "healthy"
        assert health["provider"] == "memcached"
        assert health["latency_ms"] >= 0.0

        # 2. Basic CRUD & Type Preservation
        assert service_a.set("str_val", "Memcached Integration") is True
        assert service_a.get("str_val") == "Memcached Integration"

        assert service_a.set("int_val", 42) is True
        assert service_a.get("int_val") == 42
        assert type(service_a.get("int_val")) is int

        assert service_a.set("bool_val", True) is True
        assert service_a.get("bool_val") is True
        assert type(service_a.get("bool_val")) is bool

        nested_doc = {"id": 202, "tags": ["fast", "memory"], "config": {"active": False, "weight": 9.2}}
        assert service_a.set("json_doc", nested_doc) is True
        assert service_a.get("json_doc") == nested_doc

        raw_bytes = b"\xaa\xbb\xcc\xdd binary test"
        assert service_a.set("bytes_val", raw_bytes) is True
        assert service_a.get("bytes_val") == raw_bytes

        # 3. Cached None vs Miss
        assert service_a.get("unassigned_key") is None
        assert service_a.exists("unassigned_key") is False

        assert service_a.set("none_key", None) is True
        assert service_a.exists("none_key") is True
        is_hit, val = service_a.get_with_status("none_key")
        assert is_hit is True
        assert val is None

        # 4. TTL Expiration (1 second)
        assert service_a.set("ttl_key", "expiring_soon", ttl=1) is True
        assert service_a.get("ttl_key") == "expiring_soon"
        time.sleep(1.2)
        assert service_a.get("ttl_key") is None
        assert service_a.exists("ttl_key") is False

        # 5. Large TTL (>30 days / 2592000s) Unix epoch translation
        assert service_a.set("large_ttl_key", "stored_long", ttl=3000000) is True
        assert service_a.get("large_ttl_key") == "stored_long"

        # 6. Namespace-Safe Clear
        service_b.set("shared_id", "Beta MC Preserved")
        service_a.set("shared_id", "Alpha MC To Delete")

        assert service_a.clear() is True

        assert service_a.get("shared_id") is None
        assert service_b.get("shared_id") == "Beta MC Preserved"

        # Clean up
        service_b.clear()
    finally:
        service_a.close()


def test_real_backend_offline_error_normalization():
    """Verify that attempting to connect to an offline backend raises normalized CacheConnectionError or CacheTimeoutError."""
    # Port 59999 is offline
    offline_adapter = RedisAdapter(host="127.0.0.1", port=59999, socket_connect_timeout=0.2, socket_timeout=0.2)
    service = CacheService(provider=offline_adapter)

    with pytest.raises((CacheConnectionError, CacheTimeoutError)):
        service.get("any_key")

    health = service.health_check()
    assert health["status"] == "unhealthy"
    service.close()
