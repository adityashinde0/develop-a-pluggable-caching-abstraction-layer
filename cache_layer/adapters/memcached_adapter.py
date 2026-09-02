"""Memcached backend adapter implementing CacheProvider contract with connection pooling."""

import socket
import time
from typing import Any, Dict, Optional

try:
    import pymemcache
    from pymemcache.client.base import PooledClient
    from pymemcache.exceptions import (
        MemcacheClientError,
        MemcacheError,
        MemcacheServerError,
        MemcacheUnknownError,
    )
except ImportError:
    pymemcache = None
    PooledClient = None
    MemcacheError = Exception
    MemcacheClientError = Exception
    MemcacheServerError = Exception
    MemcacheUnknownError = Exception

from cache_layer.contract import CacheProvider
from cache_layer.exceptions import (
    CacheBackendError,
    CacheConfigurationError,
    CacheConnectionError,
    CacheTimeoutError,
)


class MemcachedAdapter(CacheProvider):
    """Production-grade Memcached adapter with connection pooling and normalized error mapping."""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 11211,
        connect_timeout: float = 2.0,
        timeout: float = 2.0,
        max_pool_size: int = 50,
        client: Optional[Any] = None,
    ):
        if pymemcache is None and client is None:
            raise CacheConfigurationError("The 'pymemcache' package is not installed.")

        self._host = host
        self._port = port
        self._connect_timeout = connect_timeout
        self._timeout = timeout
        self._max_pool_size = max_pool_size

        if client is not None:
            self._client = client
        else:
            self._client = PooledClient(
                server=(self._host, self._port),
                connect_timeout=self._connect_timeout,
                timeout=self._timeout,
                max_pool_size=self._max_pool_size,
                no_delay=True,
                ignore_exc=False,
                default_noreply=False,
            )

    @property
    def provider_name(self) -> str:
        return "memcached"

    def _handle_error(self, err: Exception, op_name: str) -> None:
        if isinstance(err, (socket.timeout, TimeoutError)):
            raise CacheTimeoutError(
                f"Memcached operation timed out during {op_name}: {err}", original_error=err
            ) from err

        if isinstance(err, (ConnectionRefusedError, ConnectionResetError, ConnectionError)):
            raise CacheConnectionError(
                f"Memcached connection failed during {op_name}: {err}", original_error=err
            ) from err

        if isinstance(err, MemcacheError):
            err_msg = str(err).lower()
            if "connection" in err_msg or "refused" in err_msg or "closed" in err_msg or "reset" in err_msg:
                raise CacheConnectionError(
                    f"Memcached connection error during {op_name}: {err}", original_error=err
                ) from err
            if "timeout" in err_msg or "timed out" in err_msg:
                raise CacheTimeoutError(
                    f"Memcached timeout during {op_name}: {err}", original_error=err
                ) from err
            raise CacheBackendError(
                f"Memcached error during {op_name}: {err}", original_error=err
            ) from err

        if isinstance(err, OSError):
            raise CacheConnectionError(
                f"Socket/OS error during Memcached {op_name}: {err}", original_error=err
            ) from err

        raise CacheBackendError(
            f"Unexpected error in Memcached adapter during {op_name}: {err}", original_error=err
        ) from err

    def get(self, key: str) -> Optional[bytes]:
        try:
            val = self._client.get(key)
            if val is None:
                return None
            if isinstance(val, memoryview):
                return val.tobytes()
            if isinstance(val, (bytes, bytearray)):
                return bytes(val)
            if isinstance(val, str):
                return val.encode("utf-8")
            return bytes(val)
        except (CacheConnectionError, CacheTimeoutError, CacheBackendError):
            raise
        except Exception as err:
            self._handle_error(err, "get")

    def set(self, key: str, value: bytes, ttl: Optional[int] = None) -> bool:
        try:
            expire = ttl if ttl is not None else 0
            if ttl == 0:
                self._client.delete(key)
                return True
            result = self._client.set(key, value, expire=expire)
            return bool(result)
        except (CacheConnectionError, CacheTimeoutError, CacheBackendError):
            raise
        except Exception as err:
            self._handle_error(err, "set")

    def delete(self, key: str) -> bool:
        try:
            self._client.delete(key)
            return True
        except (CacheConnectionError, CacheTimeoutError, CacheBackendError):
            raise
        except Exception as err:
            self._handle_error(err, "delete")

    def clear(self) -> bool:
        try:
            self._client.flush_all()
            return True
        except (CacheConnectionError, CacheTimeoutError, CacheBackendError):
            raise
        except Exception as err:
            self._handle_error(err, "clear")

    def health_check(self) -> Dict[str, Any]:
        start = time.perf_counter()
        try:
            stats = self._client.stats()
            latency_ms = (time.perf_counter() - start) * 1000.0
            return {
                "status": "healthy",
                "provider": self.provider_name,
                "latency_ms": round(latency_ms, 3),
                "details": {
                    "host": self._host,
                    "port": self._port,
                    "server_version": (
                        stats.get(b"version", b"").decode("utf-8", errors="replace")
                        if isinstance(stats, dict)
                        else "unknown"
                    ),
                },
            }
        except Exception as err:
            latency_ms = (time.perf_counter() - start) * 1000.0
            return {
                "status": "unhealthy",
                "provider": self.provider_name,
                "latency_ms": round(latency_ms, 3),
                "details": {"error": str(err), "error_type": type(err).__name__},
            }

    def close(self) -> None:
        try:
            if hasattr(self._client, "close"):
                self._client.close()
        except Exception:
            pass
