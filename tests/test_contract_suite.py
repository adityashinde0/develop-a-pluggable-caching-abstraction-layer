"""Universal contract test suite executed identically against all cache providers."""

import time
from unittest.mock import MagicMock
import pytest

from cache_layer.adapters.memcached_adapter import MemcachedAdapter
from cache_layer.adapters.redis_adapter import RedisAdapter
from cache_layer.service import CacheService


def create_mock_adapter(adapter_cls):
    """Create an adapter backed by a simulated memory store."""
    mock_client = MagicMock()
    store = {}
    expirations = {}

    def fake_get(key):
        if key in expirations and time.time() > expirations[key]:
            store.pop(key, None)
            expirations.pop(key, None)
            return None
        return store.get(key)

    def fake_set(key, value, **kwargs):
        if "ex" in kwargs and kwargs["ex"] is not None and kwargs["ex"] > 0:
            # Redis 'ex' parameter is always relative duration in seconds
            expirations[key] = time.time() + kwargs["ex"]
        elif "expire" in kwargs and kwargs["expire"] is not None and kwargs["expire"] > 0:
            # Memcached 'expire' parameter: relative if <= 2592000, absolute Unix epoch timestamp if > 2592000
            if kwargs["expire"] > 2592000:
                expirations[key] = kwargs["expire"]
            else:
                expirations[key] = time.time() + kwargs["expire"]
        else:
            expirations.pop(key, None)
        store[key] = value
        return True

    def fake_delete(*keys):
        for key in keys:
            store.pop(key, None)
            expirations.pop(key, None)
        return True

    def fake_exists(key):
        return 1 if key in store else 0

    def fake_scan_iter(match=None, count=None):
        if match:
            prefix = match.replace("*", "")
            for k in list(store.keys()):
                if k.startswith(prefix):
                    yield k
        else:
            for k in list(store.keys()):
                yield k

    def fake_flushdb():
        store.clear()
        expirations.clear()
        return True

    def fake_flush_all():
        store.clear()
        expirations.clear()
        return True

    mock_client.get.side_effect = fake_get
    mock_client.set.side_effect = fake_set
    mock_client.delete.side_effect = fake_delete
    mock_client.exists.side_effect = fake_exists
    mock_client.scan_iter.side_effect = fake_scan_iter
    mock_client.flushdb.side_effect = fake_flushdb
    mock_client.flush_all.side_effect = fake_flush_all
    mock_client.ping.return_value = True
    mock_client.stats.return_value = {b"version": b"1.6.9"}

    return adapter_cls(client=mock_client)


@pytest.fixture(params=[RedisAdapter, MemcachedAdapter], ids=["RedisAdapter", "MemcachedAdapter"])
def provider(request):
    adapter = create_mock_adapter(request.param)
    yield adapter
    adapter.close()


def test_contract_basic_crud(provider):
    """Verify that every provider satisfies standard CRUD contract."""
    service = CacheService(provider=provider, namespace="contract_test")

    # 1. Miss
    assert service.get("missing_key") is None
    assert service.exists("missing_key") is False

    # 2. String value
    assert service.set("str_key", "hello_world") is True
    assert service.get("str_key") == "hello_world"
    assert service.exists("str_key") is True

    # 3. Numeric primitives
    assert service.set("int_key", 100) is True
    assert service.get("int_key") == 100
    assert type(service.get("int_key")) is int

    assert service.set("float_key", 99.99) is True
    assert service.get("float_key") == 99.99
    assert type(service.get("float_key")) is float

    # 4. Boolean (distinct from int 1/0)
    assert service.set("bool_key", True) is True
    assert service.get("bool_key") is True
    assert type(service.get("bool_key")) is bool

    # 5. Complex JSON nested structures
    nested = {
        "user": {"id": 1, "tags": ["admin", "beta"]},
        "active": True,
        "count": 42,
    }
    assert service.set("nested_key", nested) is True
    assert service.get("nested_key") == nested

    # 6. Binary payload
    raw_bytes = b"\x00\xff\x10\x20 binary test"
    assert service.set("bytes_key", raw_bytes) is True
    assert service.get("bytes_key") == raw_bytes

    # 7. Delete
    assert service.delete("str_key") is True
    assert service.get("str_key") is None
    assert service.exists("str_key") is False

    # 8. Clear
    assert service.clear() is True
    assert service.get("nested_key") is None
    assert service.get("bytes_key") is None


def test_contract_cached_none_vs_miss(provider):
    """Verify unambiguous distinction between Cache Miss and Cached None."""
    service = CacheService(provider=provider, namespace="none_test")

    # 1. Key not set -> Miss
    is_hit, val = service.get_with_status("key_unassigned")
    assert is_hit is False
    assert val is None
    assert service.exists("key_unassigned") is False
    assert service.get("key_unassigned", default="fallback") == "fallback"

    # 2. Key explicitly set to None -> Hit with value None
    assert service.set("key_none", None) is True
    is_hit, val = service.get_with_status("key_none")
    assert is_hit is True
    assert val is None
    assert service.exists("key_none") is True
    # Default is not returned because it is a hit
    assert service.get("key_none", default="fallback") is None

    # 3. Delete key -> Becomes Miss again
    assert service.delete("key_none") is True
    is_hit, val = service.get_with_status("key_none")
    assert is_hit is False
    assert val is None
    assert service.exists("key_none") is False


def test_contract_namespace_isolation_and_clear(provider):
    """Verify that clearing namespace A does NOT destroy data in namespace B."""
    service_a = CacheService(provider=provider, namespace="app_alpha")
    service_b = CacheService(provider=provider, namespace="app_beta")

    service_a.set("user_101", "Alpha User Data")
    service_b.set("user_101", "Beta User Data")

    assert service_a.get("user_101") == "Alpha User Data"
    assert service_b.get("user_101") == "Beta User Data"

    # Clear ONLY namespace Alpha
    assert service_a.clear() is True

    # Namespace Alpha data is gone
    assert service_a.get("user_101") is None
    assert service_a.exists("user_101") is False

    # Namespace Beta data is preserved!
    assert service_b.get("user_101") == "Beta User Data"
    assert service_b.exists("user_101") is True


def test_contract_ttl_semantics(provider):
    """Verify TTL handling across short, zero, and large (>30 days) durations."""
    service = CacheService(provider=provider, namespace="ttl_test")

    # 1. TTL = 0 (immediate expiration)
    assert service.set("k_zero", "v", ttl=0) is True
    assert service.get("k_zero") is None
    assert service.exists("k_zero") is False

    # 2. Standard TTL
    assert service.set("k_std", "v_std", ttl=300) is True
    assert service.get("k_std") == "v_std"

    # 3. Large TTL (>30 days / 2592000s) - verifies Memcached Unix epoch conversion
    large_ttl = 3000000  # ~34.7 days
    assert service.set("k_large", "v_large", ttl=large_ttl) is True
    assert service.get("k_large") == "v_large"


def test_contract_health_check(provider):
    """Verify that every provider reports standardized health information."""
    health = provider.health_check()
    assert isinstance(health, dict)
    assert "status" in health
    assert "provider" in health
    assert health["provider"] in ("redis", "memcached")
    assert "latency_ms" in health
