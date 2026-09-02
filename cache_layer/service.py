"""Unified CacheService coordinating validation, serialization, and adapter operations."""

from typing import Any, Dict, Optional

from cache_layer.contract import CacheProvider
from cache_layer.exceptions import CacheError
from cache_layer.serializer import PortableJsonSerializer, Serializer
from cache_layer.validation import validate_key, validate_namespace, validate_ttl


class CacheService:
    """Application-facing caching service with unified semantics across all providers."""

    def __init__(
        self,
        provider: CacheProvider,
        serializer: Optional[Serializer] = None,
        namespace: Optional[str] = None,
    ):
        if not isinstance(provider, CacheProvider):
            raise TypeError(f"Provider must implement CacheProvider, got {type(provider).__name__}")

        self._provider = provider
        self._serializer = serializer if serializer is not None else PortableJsonSerializer()
        self._namespace = validate_namespace(namespace)

    @property
    def provider(self) -> CacheProvider:
        """The underlying cache backend provider."""
        return self._provider

    @property
    def provider_name(self) -> str:
        """Name of the active provider."""
        return self._provider.provider_name

    @property
    def serializer(self) -> Serializer:
        """The active serializer."""
        return self._serializer

    @property
    def namespace(self) -> Optional[str]:
        """Configured namespace prefix."""
        return self._namespace

    def _format_key(self, key: str) -> str:
        validated_key = validate_key(key)
        if self._namespace:
            full_key = f"{self._namespace}:{validated_key}"
            validate_key(full_key)
            return full_key
        return validated_key

    def get(self, key: str) -> Any:
        """Retrieve and deserialize the value for a given key.

        Returns:
            The deserialized Python value, or None on cache miss.
        """
        full_key = self._format_key(key)
        raw_bytes = self._provider.get(full_key)
        if raw_bytes is None:
            return None
        return self._serializer.deserialize(raw_bytes)

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Serialize and store a value under the given key.

        Args:
            key: Cache key.
            value: Any JSON-serializable or primitive Python value / bytes.
            ttl: Optional TTL in seconds.

        Returns:
            True if successfully stored, False otherwise.
        """
        full_key = self._format_key(key)
        validated_ttl = validate_ttl(ttl)
        raw_bytes = self._serializer.serialize(value)
        return self._provider.set(full_key, raw_bytes, ttl=validated_ttl)

    def delete(self, key: str) -> bool:
        """Delete a key from the cache.

        Returns:
            True if deletion was acknowledged.
        """
        full_key = self._format_key(key)
        return self._provider.delete(full_key)

    def clear(self) -> bool:
        """Clear all entries in the cache store/namespace.

        Returns:
            True if cleared successfully.
        """
        return self._provider.clear()

    def health_check(self) -> Dict[str, Any]:
        """Check backend connectivity and health."""
        return self._provider.health_check()

    def close(self) -> None:
        """Close provider resources."""
        self._provider.close()

    def __enter__(self) -> "CacheService":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()
