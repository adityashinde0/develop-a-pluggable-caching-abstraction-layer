"""Unit tests for normalized cache exceptions."""

import pytest
from cache_layer.exceptions import (
    CacheBackendError,
    CacheConfigurationError,
    CacheConnectionError,
    CacheError,
    CacheSerializationError,
    CacheTimeoutError,
    CacheValidationError,
)


def test_cache_error_hierarchy():
    base_err = ValueError("inner")
    err = CacheConnectionError("Connection lost", original_error=base_err)

    assert isinstance(err, CacheError)
    assert err.message == "Connection lost"
    assert err.original_error is base_err
    assert "Caused by: ValueError: inner" in str(err)


def test_exception_types():
    assert issubclass(CacheConnectionError, CacheError)
    assert issubclass(CacheTimeoutError, CacheError)
    assert issubclass(CacheValidationError, CacheError)
    assert issubclass(CacheSerializationError, CacheError)
    assert issubclass(CacheConfigurationError, CacheError)
    assert issubclass(CacheBackendError, CacheError)
