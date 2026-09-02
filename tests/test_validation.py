"""Unit tests for validation engine."""

import pytest
from cache_layer.exceptions import CacheValidationError
from cache_layer.validation import validate_key, validate_namespace, validate_ttl


def test_validate_key_success():
    assert validate_key("user:101:profile") == "user:101:profile"
    assert validate_key("simple_key") == "simple_key"
    assert validate_key("a" * 250) == "a" * 250


def test_validate_key_errors():
    with pytest.raises(CacheValidationError, match="must be a string"):
        validate_key(123)

    with pytest.raises(CacheValidationError, match="cannot be empty"):
        validate_key("")

    with pytest.raises(CacheValidationError, match="exceeds maximum allowed length"):
        validate_key("a" * 251)

    with pytest.raises(CacheValidationError, match="whitespace or control"):
        validate_key("key with spaces")

    with pytest.raises(CacheValidationError, match="whitespace or control"):
        validate_key("key\nwith\nnewlines")

    with pytest.raises(CacheValidationError, match="whitespace or control"):
        validate_key("key\x00null")


def test_validate_ttl():
    assert validate_ttl(None) is None
    assert validate_ttl(0) == 0
    assert validate_ttl(3600) == 3600

    with pytest.raises(CacheValidationError, match="must be an integer"):
        validate_ttl("3600")

    with pytest.raises(CacheValidationError, match="must be an integer"):
        validate_ttl(36.5)

    with pytest.raises(CacheValidationError, match="must be an integer"):
        validate_ttl(True)

    with pytest.raises(CacheValidationError, match="cannot be negative"):
        validate_ttl(-5)


def test_validate_namespace():
    assert validate_namespace(None) is None
    assert validate_namespace("") is None
    assert validate_namespace("app_v1") == "app_v1"

    with pytest.raises(CacheValidationError, match="must be a string"):
        validate_namespace(123)

    with pytest.raises(CacheValidationError, match="whitespace or control"):
        validate_namespace("bad namespace")
