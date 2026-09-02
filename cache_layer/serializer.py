"""Portable serialization engine for the cache layer.

Converts supported Python data structures (str, int, float, bool, dict, list, bytes, None)
to and from a vendor-neutral byte representation.
"""

import base64
import json
from abc import ABC, abstractmethod
from typing import Any, Optional

from cache_layer.exceptions import CacheSerializationError


class Serializer(ABC):
    """Abstract interface for cache value serialization."""

    @abstractmethod
    def serialize(self, value: Any) -> bytes:
        """Serialize a Python value into bytes."""
        pass

    @abstractmethod
    def deserialize(self, data: Optional[bytes]) -> Any:
        """Deserialize bytes back into the original Python value."""
        pass


class PortableJsonSerializer(Serializer):
    """Portable JSON-based serializer with type-tag preservation.

    Preserves exact primitive types (int vs str vs bool vs float vs bytes)
    and complex nested JSON structures across both Redis and Memcached backends.
    """

    TYPE_STR = "s"
    TYPE_INT = "i"
    TYPE_FLOAT = "f"
    TYPE_BOOL = "b"
    TYPE_JSON = "j"
    TYPE_BYTES = "x"
    TYPE_NONE = "n"

    def serialize(self, value: Any) -> bytes:
        if value is None:
            payload = {"t": self.TYPE_NONE, "v": None}
        elif isinstance(value, bool):
            payload = {"t": self.TYPE_BOOL, "v": value}
        elif isinstance(value, int):
            payload = {"t": self.TYPE_INT, "v": value}
        elif isinstance(value, float):
            payload = {"t": self.TYPE_FLOAT, "v": value}
        elif isinstance(value, str):
            payload = {"t": self.TYPE_STR, "v": value}
        elif isinstance(value, (bytes, bytearray)):
            payload = {"t": self.TYPE_BYTES, "v": base64.b64encode(value).decode("ascii")}
        elif isinstance(value, (dict, list)):
            try:
                # Ensure it is JSON serializable
                json.dumps(value)
                payload = {"t": self.TYPE_JSON, "v": value}
            except (TypeError, ValueError) as err:
                raise CacheSerializationError(
                    f"Value of type {type(value).__name__} contains non-JSON serializable elements",
                    original_error=err,
                ) from err
        else:
            raise CacheSerializationError(
                f"Unsupported data type for serialization: {type(value).__name__}"
            )

        try:
            return json.dumps(payload, separators=(",", ":")).encode("utf-8")
        except Exception as err:
            raise CacheSerializationError(
                f"Failed to serialize value: {err}", original_error=err
            ) from err

    def deserialize(self, data: Optional[bytes]) -> Any:
        if data is None:
            return None

        if not isinstance(data, (bytes, bytearray)):
            raise CacheSerializationError(
                f"Expected bytes or bytearray for deserialization, got {type(data).__name__}"
            )

        try:
            text = data.decode("utf-8")
            payload = json.loads(text)
        except Exception as err:
            raise CacheSerializationError(
                f"Failed to decode or parse serialized payload: {err}", original_error=err
            ) from err

        if not isinstance(payload, dict) or "t" not in payload or "v" not in payload:
            raise CacheSerializationError("Invalid payload structure in serialized cache entry")

        tag = payload["t"]
        val = payload["v"]

        if tag == self.TYPE_NONE:
            return None
        elif tag == self.TYPE_BOOL:
            return bool(val)
        elif tag == self.TYPE_INT:
            return int(val)
        elif tag == self.TYPE_FLOAT:
            return float(val)
        elif tag == self.TYPE_STR:
            return str(val)
        elif tag == self.TYPE_BYTES:
            try:
                return base64.b64decode(val.encode("ascii"))
            except Exception as err:
                raise CacheSerializationError(
                    f"Corrupted binary payload in cache entry: {err}", original_error=err
                ) from err
        elif tag == self.TYPE_JSON:
            return val
        else:
            raise CacheSerializationError(f"Unknown type tag in cache payload: '{tag}'")
