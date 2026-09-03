"""Unified cache provider contract for interchangeable backends."""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class CacheProvider(ABC):
    """Abstract Base Class defining the unified contract for cache adapters.

    All backend adapters (Redis, Memcached, etc.) must implement this interface.
    The contract operates on raw serialized bytes for portable storage and retrieval.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the unique identifier for the provider (e.g. 'redis', 'memcached')."""
        pass

    @abstractmethod
    def get(self, key: str) -> Optional[bytes]:
        """Retrieve the raw serialized byte payload for the given key.

        Args:
            key: The validated cache key.

        Returns:
            The raw bytes if key exists, or None if miss / expired.

        Raises:
            CacheConnectionError: If connection to backend fails.
            CacheTimeoutError: If operation times out.
            CacheBackendError: For other unexpected backend errors.
        """
        pass

    @abstractmethod
    def set(self, key: str, value: bytes, ttl: Optional[int] = None) -> bool:
        """Store the raw serialized byte payload under the given key.

        Args:
            key: The validated cache key.
            value: The raw byte payload to store.
            ttl: Optional time-to-live in seconds. If None, key does not expire.

        Returns:
            True if write succeeded, False otherwise.

        Raises:
            CacheConnectionError: If connection to backend fails.
            CacheTimeoutError: If operation times out.
            CacheBackendError: For other unexpected backend errors.
        """
        pass

    @abstractmethod
    def delete(self, key: str) -> bool:
        """Delete a key from the cache store.

        Args:
            key: The validated cache key.

        Returns:
            True if key was deleted or acknowledged, False otherwise.

        Raises:
            CacheConnectionError: If connection to backend fails.
            CacheTimeoutError: If operation times out.
            CacheBackendError: For other unexpected backend errors.
        """
        pass

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Check if a key exists in the cache store without retrieving its full payload.

        Args:
            key: The validated cache key.

        Returns:
            True if key exists and has not expired, False otherwise.

        Raises:
            CacheConnectionError: If connection to backend fails.
            CacheTimeoutError: If operation times out.
            CacheBackendError: For other unexpected backend errors.
        """
        pass

    @abstractmethod
    def clear(self, namespace: Optional[str] = None) -> bool:
        """Clear entries in the cache store.

        If a namespace is provided, only entries belonging to that namespace are cleared.
        If namespace is None, clears the entire configured cache store/database.

        Args:
            namespace: Optional namespace prefix to restrict clearing.

        Returns:
            True if clear succeeded, False otherwise.

        Raises:
            CacheConnectionError: If connection to backend fails.
            CacheTimeoutError: If operation times out.
            CacheBackendError: For other unexpected backend errors.
        """
        pass

    @abstractmethod
    def health_check(self) -> Dict[str, Any]:
        """Perform a liveness and responsiveness health check against the backend.

        Returns:
            A dictionary containing health status details:
            {
                "status": "healthy" | "unhealthy",
                "provider": str,
                "latency_ms": Optional[float],
                "details": Dict[str, Any]
            }
        """
        pass

    @abstractmethod
    def close(self) -> None:
        """Clean up and close any open connection pools or network sockets."""
        pass
