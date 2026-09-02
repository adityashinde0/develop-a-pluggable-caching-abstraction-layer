"""Pluggable Caching Abstraction Layer."""

from cache_layer.adapters.memcached_adapter import MemcachedAdapter
from cache_layer.adapters.redis_adapter import RedisAdapter
from cache_layer.contract import CacheProvider
from cache_layer.exceptions import (
    CacheBackendError,
    CacheConfigurationError,
    CacheConnectionError,
    CacheError,
    CacheSerializationError,
    CacheTimeoutError,
    CacheValidationError,
)
from cache_layer.factory import CacheConfig, ProviderFactory
from cache_layer.serializer import PortableJsonSerializer, Serializer
from cache_layer.service import CacheService
from cache_layer.validation import validate_key, validate_namespace, validate_ttl

__all__ = [
    "CacheProvider",
    "CacheService",
    "CacheConfig",
    "ProviderFactory",
    "RedisAdapter",
    "MemcachedAdapter",
    "Serializer",
    "PortableJsonSerializer",
    "validate_key",
    "validate_ttl",
    "validate_namespace",
    "CacheError",
    "CacheConnectionError",
    "CacheTimeoutError",
    "CacheValidationError",
    "CacheSerializationError",
    "CacheConfigurationError",
    "CacheBackendError",
]

