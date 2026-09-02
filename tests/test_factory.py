"""Tests for ProviderFactory and CacheConfig configuration handling."""

import os
import unittest
from unittest.mock import MagicMock

from cache_layer.exceptions import CacheConfigurationError
from cache_layer.factory import CacheConfig, ProviderFactory
from cache_layer.service import CacheService


class TestCacheConfig(unittest.TestCase):
    def test_default_config(self):
        cfg = CacheConfig()
        self.assertEqual(cfg.backend, "redis")
        self.assertEqual(cfg.host, "localhost")
        self.assertEqual(cfg.port, 6379)
        self.assertEqual(cfg.db, 0)
        self.assertIsNone(cfg.password)

    def test_memcached_default_port(self):
        cfg = CacheConfig(backend="memcached")
        self.assertEqual(cfg.backend, "memcached")
        self.assertEqual(cfg.port, 11211)

    def test_invalid_backend(self):
        with self.assertRaises(CacheConfigurationError):
            CacheConfig(backend="unsupported_provider")

    def test_from_env(self):
        env = {
            "CACHE_BACKEND": "memcached",
            "CACHE_HOST": "cache.internal",
            "CACHE_PORT": "11222",
            "CACHE_NAMESPACE": "app_v1",
        }
        cfg = CacheConfig.from_env(env)
        self.assertEqual(cfg.backend, "memcached")
        self.assertEqual(cfg.host, "cache.internal")
        self.assertEqual(cfg.port, 11222)
        self.assertEqual(cfg.namespace, "app_v1")


class TestProviderFactory(unittest.TestCase):
    def test_create_provider_redis_mock(self):
        mock_client = MagicMock()
        provider = ProviderFactory.create_provider("redis", client=mock_client)
        self.assertEqual(provider.provider_name, "redis")

    def test_create_provider_memcached_mock(self):
        mock_client = MagicMock()
        provider = ProviderFactory.create_provider("memcached", client=mock_client)
        self.assertEqual(provider.provider_name, "memcached")

    def test_create_service(self):
        mock_client = MagicMock()
        service = ProviderFactory.create_service("redis", client=mock_client)
        self.assertIsInstance(service, CacheService)
        self.assertEqual(service.provider.provider_name, "redis")


if __name__ == "__main__":
    unittest.main()
