"""Unified CacheService coordinating validation, serialization, adapter operations, and observability."""

import time
from typing import Any, Dict, Optional

from cache_layer.contract import CacheProvider
from cache_layer.exceptions import CacheError
from cache_layer.metrics import MetricsCollector
from cache_layer.serializer import PortableJsonSerializer, Serializer
from cache_layer.validation import validate_key, validate_namespace, validate_ttl


class CacheService:
    """Application-facing caching service with unified semantics across all providers."""

    def __init__(
        self,
        provider: CacheProvider,
        serializer: Optional[Serializer] = None,
        namespace: Optional[str] = None,
        metrics: Optional[MetricsCollector] = None,
        enable_metrics: bool = True,
    ):
        if not isinstance(provider, CacheProvider):
            raise TypeError(f"Provider must implement CacheProvider, got {type(provider).__name__}")

        self._provider = provider
        self._serializer = serializer if serializer is not None else PortableJsonSerializer()
        self._namespace = validate_namespace(namespace)
        self._metrics = metrics if metrics is not None else (MetricsCollector() if enable_metrics else None)

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

    @property
    def metrics(self) -> Optional[MetricsCollector]:
        """The active metrics collector, if enabled."""
        return self._metrics

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
        start = time.perf_counter()
        try:
            full_key = self._format_key(key)
            raw_bytes = self._provider.get(full_key)
            latency_ms = (time.perf_counter() - start) * 1000.0

            if raw_bytes is None:
                if self._metrics:
                    self._metrics.record_get(hit=False, latency_ms=latency_ms)
                return None

            value = self._serializer.deserialize(raw_bytes)
            if self._metrics:
                self._metrics.record_get(hit=True, latency_ms=latency_ms)
            return value
        except Exception:
            latency_ms = (time.perf_counter() - start) * 1000.0
            if self._metrics:
                self._metrics.record_error(latency_ms=latency_ms)
            raise

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Serialize and store a value under the given key.

        Args:
            key: Cache key.
            value: Any JSON-serializable or primitive Python value / bytes.
            ttl: Optional TTL in seconds.

        Returns:
            True if successfully stored, False otherwise.
        """
        start = time.perf_counter()
        try:
            full_key = self._format_key(key)
            validated_ttl = validate_ttl(ttl)
            raw_bytes = self._serializer.serialize(value)
            result = self._provider.set(full_key, raw_bytes, ttl=validated_ttl)
            latency_ms = (time.perf_counter() - start) * 1000.0
            if self._metrics:
                self._metrics.record_set(latency_ms=latency_ms)
            return result
        except Exception:
            latency_ms = (time.perf_counter() - start) * 1000.0
            if self._metrics:
                self._metrics.record_error(latency_ms=latency_ms)
            raise

    def delete(self, key: str) -> bool:
        """Delete a key from the cache.

        Returns:
            True if deletion was acknowledged.
        """
        start = time.perf_counter()
        try:
            full_key = self._format_key(key)
            result = self._provider.delete(full_key)
            latency_ms = (time.perf_counter() - start) * 1000.0
            if self._metrics:
                self._metrics.record_delete(latency_ms=latency_ms)
            return result
        except Exception:
            latency_ms = (time.perf_counter() - start) * 1000.0
            if self._metrics:
                self._metrics.record_error(latency_ms=latency_ms)
            raise

    def clear(self) -> bool:
        """Clear all entries in the cache store/namespace.

        Returns:
            True if cleared successfully.
        """
        start = time.perf_counter()
        try:
            result = self._provider.clear()
            latency_ms = (time.perf_counter() - start) * 1000.0
            if self._metrics:
                self._metrics.record_clear(latency_ms=latency_ms)
            return result
        except Exception:
            latency_ms = (time.perf_counter() - start) * 1000.0
            if self._metrics:
                self._metrics.record_error(latency_ms=latency_ms)
            raise

    def get_metrics(self) -> Dict[str, Any]:
        """Retrieve aggregated metrics snapshot including active provider."""
        if self._metrics is None:
            return {
                "active_provider": self.provider_name,
                "namespace": self.namespace,
                "metrics_enabled": False,
            }
        snapshot = self._metrics.get_snapshot()
        snapshot["active_provider"] = self.provider_name
        snapshot["namespace"] = self.namespace
        snapshot["metrics_enabled"] = True
        return snapshot

    def reset_metrics(self) -> None:
        """Reset all collected metrics."""
        if self._metrics:
            self._metrics.reset()

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
