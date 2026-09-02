"""Unit tests for portable serializer."""

import pytest
from cache_layer.exceptions import CacheSerializationError
from cache_layer.serializer import PortableJsonSerializer


def test_serializer_primitives():
    serializer = PortableJsonSerializer()

    # String
    data = serializer.serialize("hello world")
    assert serializer.deserialize(data) == "hello world"

    # Int
    data = serializer.serialize(42)
    assert serializer.deserialize(data) == 42
    assert type(serializer.deserialize(data)) is int

    # Float
    data = serializer.serialize(3.14159)
    assert serializer.deserialize(data) == 3.14159
    assert type(serializer.deserialize(data)) is float

    # Bool (must be distinct from int 1/0)
    data = serializer.serialize(True)
    assert serializer.deserialize(data) is True
    assert type(serializer.deserialize(data)) is bool

    # None
    data = serializer.serialize(None)
    assert serializer.deserialize(data) is None

    # Bytes
    raw_bytes = b"\x00\x01\xfe\xff binary string"
    data = serializer.serialize(raw_bytes)
    assert serializer.deserialize(data) == raw_bytes


def test_serializer_complex_structures():
    serializer = PortableJsonSerializer()

    payload = {
        "user_id": 101,
        "username": "alice",
        "active": True,
        "scores": [10, 20.5, 30],
        "meta": {"roles": ["admin", "editor"], "login_count": 5},
    }

    serialized = serializer.serialize(payload)
    deserialized = serializer.deserialize(serialized)

    assert deserialized == payload
    assert deserialized["scores"] == [10, 20.5, 30]
    assert deserialized["meta"]["roles"] == ["admin", "editor"]


def test_serializer_error_handling():
    serializer = PortableJsonSerializer()

    # Object not JSON serializable
    class NonSerializable:
        pass

    with pytest.raises(CacheSerializationError):
        serializer.serialize(NonSerializable())

    # Corrupted / invalid deserialization input
    with pytest.raises(CacheSerializationError):
        serializer.deserialize(b"invalid-json-data")

    with pytest.raises(CacheSerializationError):
        serializer.deserialize(b'{"t":"invalid_tag","v":123}')

    # Non-bytes input to deserialize
    with pytest.raises(CacheSerializationError):
        serializer.deserialize("string instead of bytes")
