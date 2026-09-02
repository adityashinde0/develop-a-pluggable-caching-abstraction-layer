"""Normalized exception hierarchy for the caching abstraction layer.

Ensures that provider-specific errors (Redis, Memcached, network timeouts, etc.)
are consistently mapped to provider-neutral exception types.
"""

from typing import Optional


class CacheError(Exception):
    """Base exception for all cache-related errors."""

    def __init__(self, message: str, original_error: Optional[Exception] = None):
        super().__init__(message)
        self.message = message
        self.original_error = original_error

    def __str__(self) -> str:
        if self.original_error:
            return f"{self.message} (Caused by: {type(self.original_error).__name__}: {self.original_error})"
        return self.message


class CacheConnectionError(CacheError):
    """Raised when a connection to the cache backend fails or cannot be established."""
    pass


class CacheTimeoutError(CacheError):
    """Raised when an operation against the cache backend times out."""
    pass


class CacheValidationError(CacheError):
    """Raised when a key, value, or parameter fails validation rules."""
    pass


class CacheSerializationError(CacheError):
    """Raised when value serialization or deserialization fails."""
    pass


class CacheConfigurationError(CacheError):
    """Raised when provider configuration or initialization parameters are invalid."""
    pass


class CacheBackendError(CacheError):
    """Raised when an unexpected error occurs within the cache backend provider."""
    pass
