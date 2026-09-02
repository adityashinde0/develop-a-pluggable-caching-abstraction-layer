"""Reproducible Benchmark Harness for Pluggable Caching Abstraction Layer (Phase 2).

Executes an identical, fair workload against both Redis and Memcached providers
and measures:
- Total Request Count
- Cache Hits / Misses & Hit Ratio
- Average Latency (ms)
- p50 Latency (ms)
- p95 Latency (ms)
- Operations per Second (Throughput)
"""

import platform
import random
import sys
import time
from typing import Any, Dict
from unittest.mock import MagicMock

from cache_layer.adapters.memcached_adapter import MemcachedAdapter
from cache_layer.adapters.redis_adapter import RedisAdapter
from cache_layer.factory import ProviderFactory
from cache_layer.service import CacheService


def create_simulated_backend(name: str):
    """Create in-memory adapter for fair standalone benchmarking."""
    mock_client = MagicMock()
    store = {}

    mock_client.get.side_effect = lambda k: store.get(k)
    mock_client.set.side_effect = lambda k, v, **kw: store.update({k: v}) or True
    mock_client.delete.side_effect = lambda k: store.pop(k, None) is not None or True
    mock_client.flushdb.side_effect = lambda: store.clear() or True
    mock_client.flush_all.side_effect = lambda: store.clear() or True
    mock_client.ping.return_value = True
    mock_client.stats.return_value = {b"version": b"1.6.9"}

    if name == "redis":
        return RedisAdapter(client=mock_client)
    else:
        return MemcachedAdapter(client=mock_client)


def run_benchmark_workload(service: CacheService, num_keys: int = 200, num_lookups: int = 800) -> Dict[str, Any]:
    """Execute standard identical benchmark workload:

    1. Prepopulate `num_keys` keys.
    2. Perform `num_lookups` reads with 75% hitting existing keys and 25% missing.
    """
    service.reset_metrics()
    service.clear()

    # Pre-generate standard JSON payloads (approx 200 bytes each)
    dataset = {
        f"item_{i}": {
            "id": i,
            "sku": f"SKU-{i:05d}",
            "price": round(10.0 + (i * 0.5), 2),
            "available": (i % 2 == 0),
            "tags": ["bench", "test", f"tag_{i % 5}"],
        }
        for i in range(num_keys)
    }

    start_bench = time.perf_counter()

    # 1. Warm-up / Populate SETs
    for key, data in dataset.items():
        service.set(key, data, ttl=300)

    # 2. Mixed GET workload
    random.seed(42)  # Deterministic seed for exact reproducibility across providers
    for _ in range(num_lookups):
        if random.random() < 0.75:
            # Existing key (Hit)
            key_id = random.randint(0, num_keys - 1)
            service.get(f"item_{key_id}")
        else:
            # Non-existent key (Miss)
            key_id = random.randint(num_keys, num_keys + 500)
            service.get(f"item_{key_id}")

    elapsed_s = time.perf_counter() - start_bench
    metrics = service.get_metrics()
    metrics["total_duration_s"] = round(elapsed_s, 4)
    metrics["throughput_ops_sec"] = round(metrics["request_count"] / max(elapsed_s, 0.0001), 1)
    return metrics


def print_comparison_table(redis_results: Dict[str, Any], mc_results: Dict[str, Any], mode_label: str):
    print("\n" + "=" * 80)
    print(f"  CACHING ABSTRACTION BENCHMARK REPORT ({mode_label.upper()})")
    print("=" * 80)
    print(f"  Environment: Python {platform.python_version()} on {platform.system()} ({platform.machine()})")
    print(f"  Workload:    200 Key Writes + 800 Reads (75% Expected Hit Ratio)")
    print("-" * 80)

    header = f"{'Metric':<25} | {'Redis Adapter':<24} | {'Memcached Adapter':<24}"
    divider = f"{'-'*25}-|-{'-'*24}-|-{'-'*24}"
    print(header)
    print(divider)

    rows = [
        ("Total Operations", f"{redis_results['request_count']}", f"{mc_results['request_count']}"),
        ("Cache Hits", f"{redis_results['cache_hits']}", f"{mc_results['cache_hits']}"),
        ("Cache Misses", f"{redis_results['cache_misses']}", f"{mc_results['cache_misses']}"),
        ("Hit Ratio", f"{redis_results['hit_ratio']*100:.1f}%", f"{mc_results['hit_ratio']*100:.1f}%"),
        ("Average Latency", f"{redis_results['average_latency_ms']:.4f} ms", f"{mc_results['average_latency_ms']:.4f} ms"),
        ("p50 Latency", f"{redis_results['p50_latency_ms']:.4f} ms", f"{mc_results['p50_latency_ms']:.4f} ms"),
        ("p95 Latency", f"{redis_results['p95_latency_ms']:.4f} ms", f"{mc_results['p95_latency_ms']:.4f} ms"),
        ("Total Duration", f"{redis_results['total_duration_s']:.3f} s", f"{mc_results['total_duration_s']:.3f} s"),
        ("Throughput", f"{redis_results['throughput_ops_sec']:,.0f} ops/sec", f"{mc_results['throughput_ops_sec']:,.0f} ops/sec"),
        ("Errors", f"{redis_results['errors']}", f"{mc_results['errors']}"),
    ]

    for label, r_val, m_val in rows:
        print(f"{label:<25} | {r_val:<24} | {m_val:<24}")

    print("=" * 80)


def main():
    live_mode = "--live" in sys.argv
    mode_label = "Live Backends" if live_mode else "Simulated In-Memory Harness"

    if live_mode:
        r_provider = ProviderFactory.create_provider({"backend": "redis"})
        m_provider = ProviderFactory.create_provider({"backend": "memcached"})
    else:
        r_provider = create_simulated_backend("redis")
        m_provider = create_simulated_backend("memcached")

    r_service = CacheService(provider=r_provider, namespace="bench_redis")
    m_service = CacheService(provider=m_provider, namespace="bench_memcached")

    print(f"Running benchmark on {mode_label}...")
    redis_metrics = run_benchmark_workload(r_service)
    mc_metrics = run_benchmark_workload(m_service)

    print_comparison_table(redis_metrics, mc_metrics, mode_label)

    r_service.close()
    m_service.close()


if __name__ == "__main__":
    main()
