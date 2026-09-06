"""Unit tests for MemcachedAdapter with error injection and mock backend."""

import socket
from unittest.mock import MagicMock
import pytest

from cache_layer.adapters.memcached_adapter import (
    MemcachedAdapter,
    MemcacheError,
    MemcacheServerError,
)
from cache_layer.exceptions import (
    CacheBackendError,
    CacheConnectionError,
    CacheTimeoutError,
)


def test_memcached_adapter_crud():
    mock_client = MagicMock()
    mock_client.get.return_value = b"test_payload"
    mock_client.set.return_value = True
    mock_client.delete.return_value = True
    mock_client.flush_all.return_value = True
    mock_client.stats.return_value = {b"version": b"1.6.9"}

    adapter = MemcachedAdapter(client=mock_client)
    assert adapter.provider_name == "memcached"

    # Set with TTL
    assert adapter.set("key1", b"test_payload", ttl=60) is True
    mock_client.set.assert_called_once_with("key1", b"test_payload", expire=60)

    # Set without TTL
    mock_client.set.reset_mock()
    assert adapter.set("key2", b"test_payload", ttl=None) is True
    mock_client.set.assert_called_once_with("key2", b"test_payload", expire=0)

    # Set with TTL 0 (immediate expiration)
    mock_client.delete.reset_mock()
    assert adapter.set("key3", b"test_payload", ttl=0) is True
    mock_client.delete.assert_called_once_with("key3")

    # Get
    val = adapter.get("key1")
    assert val == b"test_payload"

    # Get None
    mock_client.get.return_value = None
    assert adapter.get("missing_key") is None

    # Delete
    assert adapter.delete("key1") is True

    # Clear
    assert adapter.clear() is True

    # Health check healthy
    health = adapter.health_check()
    assert health["status"] == "healthy"
    assert health["provider"] == "memcached"
    assert health["details"]["server_version"] == "1.6.9"
    assert "latency_ms" in health

    # Close
    adapter.close()
    mock_client.close.assert_called_once()


def test_memcached_adapter_errors():
    mock_client = MagicMock()
    adapter = MemcachedAdapter(client=mock_client)

    # Connection Error
    mock_client.get.side_effect = ConnectionRefusedError("Connection refused to 11211")
    with pytest.raises(CacheConnectionError):
        adapter.get("k")

    # Socket Timeout
    mock_client.set.side_effect = socket.timeout("timed out")
    with pytest.raises(CacheTimeoutError):
        adapter.set("k", b"v")

    # Memcache Error with connection in text
    mock_client.delete.side_effect = MemcacheError("connection reset by peer")
    with pytest.raises(CacheConnectionError):
        adapter.delete("k")

    # Memcache Server Error
    mock_client.flush_all.side_effect = MemcacheServerError("Out of memory")
    with pytest.raises(CacheBackendError):
        adapter.clear()

    # Health check unhealthy
    mock_client.stats.side_effect = ConnectionRefusedError("Server down")
    health = adapter.health_check()
    assert health["status"] == "unhealthy"
    assert "Server down" in health["details"]["error"]
