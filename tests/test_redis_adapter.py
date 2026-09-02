"""Unit tests for RedisAdapter with error injection and mock backend."""

from unittest.mock import MagicMock
import pytest
import redis
from redis.exceptions import ConnectionError as RedisConnectionError, TimeoutError as RedisTimeoutError, RedisError

from cache_layer.adapters.redis_adapter import RedisAdapter
from cache_layer.exceptions import (
    CacheBackendError,
    CacheConnectionError,
    CacheTimeoutError,
)


def test_redis_adapter_crud():
    mock_client = MagicMock()
    mock_client.get.return_value = b"test_payload"
    mock_client.set.return_value = True
    mock_client.delete.return_value = 1
    mock_client.flushdb.return_value = True
    mock_client.ping.return_value = True

    adapter = RedisAdapter(client=mock_client)
    assert adapter.provider_name == "redis"

    # Set with TTL
    assert adapter.set("key1", b"test_payload", ttl=60) is True
    mock_client.set.assert_called_once_with("key1", b"test_payload", ex=60)

    # Set without TTL
    mock_client.set.reset_mock()
    assert adapter.set("key2", b"test_payload", ttl=None) is True
    mock_client.set.assert_called_once_with("key2", b"test_payload")

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
    assert health["provider"] == "redis"
    assert "latency_ms" in health

    # Close
    adapter.close()
    mock_client.close.assert_called_once()


def test_redis_adapter_errors():
    mock_client = MagicMock()
    adapter = RedisAdapter(client=mock_client)

    # Connection Error
    mock_client.get.side_effect = RedisConnectionError("Cannot connect to host:6379")
    with pytest.raises(CacheConnectionError):
        adapter.get("k")

    # Timeout Error
    mock_client.set.side_effect = RedisTimeoutError("Socket timeout")
    with pytest.raises(CacheTimeoutError):
        adapter.set("k", b"v")

    # Generic Redis Backend Error
    mock_client.delete.side_effect = RedisError("OOM command not allowed")
    with pytest.raises(CacheBackendError):
        adapter.delete("k")

    # Health check unhealthy
    mock_client.ping.side_effect = RedisConnectionError("Server down")
    health = adapter.health_check()
    assert health["status"] == "unhealthy"
    assert "Server down" in health["details"]["error"]
