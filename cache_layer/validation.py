"""Normalized validation engine for cache keys, TTL values, and namespaces."""

import re
from typing import Optional

from cache_layer.exceptions import CacheValidationError

# Memcached protocol limits keys to 250 raw bytes without whitespace/control chars
MAX_KEY_BYTES = 250
KEY_DISALLOWED_PATTERN = re.compile(r"[\s\x00-\x1f\x7f]")


def validate_key(key: str, max_bytes: int = MAX_KEY_BYTES) -> str:
    """Validate a cache key according to the unified portable standard.

    Enforces:
    - Must be a non-empty string.
    - UTF-8 encoded byte length must not exceed max_bytes (default 250 bytes).
    - Must not contain whitespace or ASCII control characters.

    Args:
        key: The key string to validate.
        max_bytes: Maximum allowed UTF-8 byte length (defaults to 250).

    Returns:
        The validated key.

    Raises:
        CacheValidationError: If key is invalid.
    """
    if not isinstance(key, str):
        raise CacheValidationError(f"Cache key must be a string, got {type(key).__name__}")

    if not key:
        raise CacheValidationError("Cache key cannot be empty")

    if KEY_DISALLOWED_PATTERN.search(key):
        raise CacheValidationError(
            "Cache key contains invalid characters (whitespace or control characters are not permitted)"
        )

    key_bytes = key.encode("utf-8")
    if len(key_bytes) > max_bytes:
        raise CacheValidationError(
            f"Cache key UTF-8 byte length ({len(key_bytes)}) exceeds maximum allowed limit of {max_bytes} bytes"
        )

    return key


def validate_ttl(ttl: Optional[int]) -> Optional[int]:
    """Validate TTL parameter.

    Args:
        ttl: Time to live in seconds, or None for non-expiring keys.

    Returns:
        The validated TTL integer or None.

    Raises:
        CacheValidationError: If TTL is invalid.
    """
    if ttl is None:
        return None

    if isinstance(ttl, bool) or not isinstance(ttl, int):
        raise CacheValidationError(f"TTL must be an integer (seconds) or None, got {type(ttl).__name__}")

    if ttl < 0:
        raise CacheValidationError(f"TTL cannot be negative: {ttl}")

    return ttl


def validate_namespace(namespace: Optional[str], max_bytes: int = MAX_KEY_BYTES) -> Optional[str]:
    """Validate a namespace prefix string.

    Args:
        namespace: Optional namespace prefix.
        max_bytes: Maximum allowed UTF-8 byte length.

    Returns:
        Validated namespace or None.

    Raises:
        CacheValidationError: If namespace contains invalid characters or exceeds byte limits.
    """
    if namespace is None or namespace == "":
        return None

    if not isinstance(namespace, str):
        raise CacheValidationError(
            f"Namespace must be a string, got {type(namespace).__name__}"
        )

    if KEY_DISALLOWED_PATTERN.search(namespace):
        raise CacheValidationError(
            "Namespace contains invalid characters (whitespace or control characters are not permitted)"
        )

    ns_bytes = namespace.encode("utf-8")
    if len(ns_bytes) > max_bytes:
        raise CacheValidationError(
            f"Namespace UTF-8 byte length ({len(ns_bytes)}) exceeds maximum allowed limit of {max_bytes} bytes"
        )

    return namespace
