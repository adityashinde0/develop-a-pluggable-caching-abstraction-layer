"""Contract & API Demo Harness.

Demonstrates identical cache operations across Redis and Memcached via configuration switching,
including rich primitive/complex data handling, namespace isolation, TTL semantics, and controlled failure handling.
"""

import os
import sys
import time
from typing import Any, Dict
from unittest.mock import MagicMock

from cache_layer.contract import CacheProvider
from cache_layer.exceptions import (
    CacheConnectionError,
    CacheError,
    CacheTimeoutError,
    CacheValidationError,
)
from cache_layer.factory import CacheConfig, ProviderFactory
from cache_layer.service import CacheService


def run_demo_suite(backend_name: str, client_override: Any = None) -> bool:
    print(f"\n==================================================")
    print(f" Running Demo Harness on Backend: {backend_name.upper()}")
    print(f"==================================================")

    config = CacheConfig(backend=backend_name, namespace="demo")
    service = ProviderFactory.create_service(config=config, client=client_override)

    try:
        # 1. Health Check
        health = service.health_check()
        print(f"[1] Health Check -> status={health.get('status')}, provider={health.get('provider')}, latency_ms={health.get('latency_ms')}")

        # 2. String, Integer, Dict, and List CRUD Operations
        print("\n[2] Executing CRUD operations on varied data types...")
        user_data = {
            "id": 1001,
            "username": "alex_coder",
            "active": True,
            "scores": [98.5, 100.0, 95.2],
        }
        
        service.set("session:token", "xyz-abc-123")
        service.set("user:1001", user_data)
        service.set("counter:hits", 42)

        val_token = service.get("session:token")
        val_user = service.get("user:1001")
        val_hits = service.get("counter:hits")

        print(f"    - GET session:token -> '{val_token}'")
        print(f"    - GET user:1001 -> {val_user}")
        print(f"    - GET counter:hits -> {val_hits} (type={type(val_hits).__name__})")

        assert val_token == "xyz-abc-123"
        assert val_user == user_data
        assert val_hits == 42

        # 3. TTL Expiration & Immediate Delete
        print("\n[3] Testing TTL and Deletion semantics...")
        service.set("short_lived_key", "temporary_value", ttl=1)
        print(f"    - SET short_lived_key with TTL=1s -> Immediate GET: '{service.get('short_lived_key')}'")
        time.sleep(1.1)
        expired_val = service.get("short_lived_key")
        print(f"    - GET short_lived_key after 1.1s -> {expired_val} (Expected None)")

        service.delete("session:token")
        print(f"    - DELETE session:token -> GET: {service.get('session:token')}")

        # 4. Validation & Reliability Controls
        print("\n[4] Testing Validation and Reliability Boundary...")
        try:
            service.get("invalid key with whitespace")
        except CacheValidationError as ve:
            print(f"    - Caught expected validation error for key: {ve}")

        # 5. Clear Store
        print("\n[5] Clearing store...")
        service.clear()
        print(f"    - GET user:1001 after clear() -> {service.get('user:1001')}")

        print(f"\n=== [{backend_name.upper()}] Demo Suite Completed Successfully! ===")
        return True

    finally:
        service.close()


def run_mock_demo() -> bool:
    """Run full demo against mocked Redis and Memcached clients if live services are offline."""
    print("\n--- Running Mocked Demo Harness for Verification ---")

    # Mock Redis setup
    redis_store: Dict[str, bytes] = {}
    redis_ttl: Dict[str, float] = {}
    mock_redis = MagicMock()

    def redis_get(k):
        if k in redis_ttl and time.time() > redis_ttl[k]:
            redis_store.pop(k, None)
            redis_ttl.pop(k, None)
            return None
        return redis_store.get(k)

    def redis_set(k, v, ex=None):
        redis_store[k] = v
        if ex:
            redis_ttl[k] = time.time() + ex
        else:
            redis_ttl.pop(k, None)
        return True

    def redis_del(k):
        redis_store.pop(k, None)
        redis_ttl.pop(k, None)
        return True

    def redis_clear():
        redis_store.clear()
        redis_ttl.clear()
        return True

    mock_redis.get.side_effect = redis_get
    mock_redis.set.side_effect = redis_set
    mock_redis.delete.side_effect = redis_del
    mock_redis.flushdb.side_effect = redis_clear
    mock_redis.ping.return_value = True

    print("\n>>> Testing Mocked Redis Adapter <<<")
    run_demo_suite("redis", client_override=mock_redis)

    # Mock Memcached setup
    memcached_store: Dict[str, bytes] = {}
    memcached_ttl: Dict[str, float] = {}
    mock_memcached = MagicMock()

    def memcached_get(k):
        if k in memcached_ttl and time.time() > memcached_ttl[k]:
            memcached_store.pop(k, None)
            memcached_ttl.pop(k, None)
            return None
        return memcached_store.get(k)

    def memcached_set(k, v, expire=0):
        memcached_store[k] = v
        if expire > 0:
            memcached_ttl[k] = time.time() + expire
        else:
            memcached_ttl.pop(k, None)
        return True

    def memcached_del(k):
        memcached_store.pop(k, None)
        memcached_ttl.pop(k, None)
        return True

    def memcached_clear():
        memcached_store.clear()
        memcached_ttl.clear()
        return True

    mock_memcached.get.side_effect = memcached_get
    mock_memcached.set.side_effect = memcached_set
    mock_memcached.delete.side_effect = memcached_del
    mock_memcached.flush_all.side_effect = memcached_clear
    mock_memcached.stats.return_value = {b"version": b"1.6.9"}

    print("\n>>> Testing Mocked Memcached Adapter <<<")
    run_demo_suite("memcached", client_override=mock_memcached)
    return True


def run_controlled_failure_demo():
    """Demonstrate normalized backend failure exception handling."""
    print("\n==================================================")
    print(" Running Controlled Backend Failure Demo")
    print("==================================================")
    
    mock_failing_client = MagicMock()
    mock_failing_client.get.side_effect = ConnectionRefusedError("Backend connection refused on port 6379")
    
    service = ProviderFactory.create_service(config="redis", client=mock_failing_client)
    try:
        service.get("some_key")
    except CacheConnectionError as e:
        print(f" Successfully caught normalized exception: {type(e).__name__}: {e}")
    finally:
        service.close()


if __name__ == "__main__":
    print("Pluggable Caching Abstraction Layer - Demo Harness")
    use_mock = os.getenv("USE_MOCK_DEMO", "1") == "1"
    
    if use_mock:
        run_mock_demo()
        run_controlled_failure_demo()
    else:
        for provider in ["redis", "memcached"]:
            try:
                run_demo_suite(provider)
            except CacheError as err:
                print(f"Error executing live demo for {provider}: {err}")
