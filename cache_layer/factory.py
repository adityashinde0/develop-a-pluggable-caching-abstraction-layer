"""Configuration parsing and provider factory module."""

import os
from typing import Any, Dict, Optional, Union

from cache_layer.adapters.memcached_adapter import MemcachedAdapter
from cache_layer.adapters.redis_adapter import RedisAdapter
from cache_layer.contract import CacheProvider
from cache_layer.exceptions import CacheConfigurationError
from cache_layer.service import CacheService


class CacheConfig:
    """Encapsulates configuration for cache provider initialization."""

    SUPPORTED_BACKENDS = ("redis", "memcached")

    def __init__(
        self,
        backend: str = "redis",
        host: str = "localhost",
        port: Optional[int] = None,
        db: int = 0,
        password: Optional[str] = None,
        socket_timeout: float = 2.0,
        socket_connect_timeout: float = 2.0,
        max_connections: int = 50,
        namespace: Optional[str] = None,
    ):
        if not backend or not isinstance(backend, str):
            raise CacheConfigurationError("Cache backend must be a non-empty string.")

        normalized_backend = backend.strip().lower()
        if normalized_backend not in self.SUPPORTED_BACKENDS:
            raise CacheConfigurationError(
                f"Unsupported cache backend '{backend}'. Supported backends: {list(self.SUPPORTED_BACKENDS)}"
            )

        self.backend = normalized_backend
        self.host = host or "localhost"

        if port is not None:
            self.port = int(port)
        else:
            self.port = 6379 if self.backend == "redis" else 11211

        self.db = int(db)
        self.password = password
        self.socket_timeout = float(socket_timeout)
        self.socket_connect_timeout = float(socket_connect_timeout)
        self.max_connections = int(max_connections)
        self.namespace = namespace

    @classmethod
    def from_env(cls, env: Optional[Dict[str, str]] = None) -> "CacheConfig":
        """Load configuration from environment variables or dictionary."""
        source = env if env is not None else os.environ

        backend = source.get("CACHE_BACKEND", "redis")
        host = source.get("CACHE_HOST", "localhost")

        raw_port = source.get("CACHE_PORT")
        port = int(raw_port) if raw_port else None

        db = int(source.get("CACHE_DB", "0"))
        password = source.get("CACHE_PASSWORD")
        socket_timeout = float(source.get("CACHE_SOCKET_TIMEOUT", "2.0"))
        socket_connect_timeout = float(source.get("CACHE_SOCKET_CONNECT_TIMEOUT", "2.0"))
        max_connections = int(source.get("CACHE_MAX_CONNECTIONS", "50"))
        namespace = source.get("CACHE_NAMESPACE")

        return cls(
            backend=backend,
            host=host,
            port=port,
            db=db,
            password=password,
            socket_timeout=socket_timeout,
            socket_connect_timeout=socket_connect_timeout,
            max_connections=max_connections,
            namespace=namespace,
        )


class ProviderFactory:
    """Factory for instantiating cache providers and services based on configuration."""

    @staticmethod
    def create_provider(
        config: Union[CacheConfig, Dict[str, Any], str],
        client: Optional[Any] = None,
    ) -> CacheProvider:
        """Create a raw CacheProvider adapter instance based on configuration."""
        if isinstance(config, str):
            cfg = CacheConfig(backend=config)
        elif isinstance(config, dict):
            cfg = CacheConfig(**config)
        elif isinstance(config, CacheConfig):
            cfg = config
        else:
            raise CacheConfigurationError("Invalid configuration provided.")

        if cfg.backend == "redis":
            return RedisAdapter(
                host=cfg.host,
                port=cfg.port,
                db=cfg.db,
                password=cfg.password,
                socket_timeout=cfg.socket_timeout,
                socket_connect_timeout=cfg.socket_connect_timeout,
                max_connections=cfg.max_connections,
                client=client,
            )
        elif cfg.backend == "memcached":
            return MemcachedAdapter(
                host=cfg.host,
                port=cfg.port,
                connect_timeout=cfg.socket_connect_timeout,
                timeout=cfg.socket_timeout,
                max_pool_size=cfg.max_connections,
                client=client,
            )

        raise CacheConfigurationError(f"Unsupported backend '{cfg.backend}'.")

    @staticmethod
    def create_service(
        config: Union[CacheConfig, Dict[str, Any], str, None] = None,
        client: Optional[Any] = None,
    ) -> CacheService:
        """Create a full CacheService instance configured according to environment or parameters."""
        if config is None:
            cfg = CacheConfig.from_env()
        elif isinstance(config, str):
            cfg = CacheConfig(backend=config)
        elif isinstance(config, dict):
            cfg = CacheConfig(**config)
        elif isinstance(config, CacheConfig):
            cfg = config
        else:
            raise CacheConfigurationError("Invalid configuration provided.")

        provider = ProviderFactory.create_provider(cfg, client=client)
        return CacheService(provider=provider, namespace=cfg.namespace)
