"""Reproducible Benchmark Harness for Pluggable Caching Abstraction Layer (Phase 2).

Executes an identical, fair workload against Redis and Memcached providers
and measures:
- Total Workload Operations (200 Writes + 800 Reads = 1,000 operations)
- Cache Hits / Misses & Hit Ratio
- Average Latency (ms)
- p50 Latency (ms)
- p95 Latency (ms)
- Operations per Second (Throughput)

Supports:
- Simulated In-Memory Mode: Measures pure abstraction and serialization overhead in isolation.
- Live Daemon Mode (`--live`): Measures real network I/O against live Redis/Memcached services.
"""

import argparse
import platform
import random
import sys
import time
from typing import Any, Dict, Optional
from unittest.mock import MagicMock

from cache_layer.adapters.memcached_adapter import MemcachedAdapter
from cache_layer.adapters.redis_adapter import RedisAdapter
from cache_layer.exceptions import CacheConnectionError, CacheError
from cache_layer.factory import ProviderFactory
from cache_layer.service import CacheService


def create_simulated_backend(name: str):
    """Create in-memory adapter for fair standalone benchmarking of library overhead."""
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

    1. Reset & clear state before measurement.
    2. Prepopulate `num_keys` keys (SET).
    3. Perform `num_lookups` reads (GET) with deterministic 75% hit / 25% miss distribution.
    """
    # Auxiliary cleanup before benchmark starts
    service.clear()
    # Reset metrics so ONLY the 1,000 workload operations are recorded
    service.reset_metrics()

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

    # 1. Warm-up / Populate SETs (num_keys = 200)
    for key, data in dataset.items():
        service.set(key, data, ttl=300)

    # 2. Mixed GET workload (num_lookups = 800)
    random.seed(42)  # Deterministic seed for exact reproducibility across providers
    for _ in range(num_lookups):
        if random.random() < 0.75:
            # Existing key (Target Hit)
            key_id = random.randint(0, num_keys - 1)
            service.get(f"item_{key_id}")
        else:
            # Non-existent key (Target Miss)
            key_id = random.randint(num_keys, num_keys + 500)
            service.get(f"item_{key_id}")

    elapsed_s = time.perf_counter() - start_bench
    metrics = service.get_metrics()
    metrics["total_duration_s"] = round(elapsed_s, 4)
    metrics["throughput_ops_sec"] = round(metrics["request_count"] / max(elapsed_s, 0.0001), 1)
    metrics["num_keys"] = num_keys
    metrics["num_lookups"] = num_lookups
    return metrics


def print_comparison_table(results: Dict[str, Dict[str, Any]], mode_label: str):
    print("\n" + "=" * 80)
    print(f"  CACHING ABSTRACTION BENCHMARK REPORT: {mode_label.upper()}")
    print("=" * 80)
    print(f"  Environment: Python {platform.python_version()} on {platform.system()} ({platform.machine()})")
    print(f"  Workload:    200 Key Writes + 800 Reads (75% Expected Target Hit Ratio)")
    print(f"  Total Workload Operations: 1,000 (200 SETs + 800 GETs)")
    print("-" * 80)

    providers = list(results.keys())
    if len(providers) == 2:
        p1, p2 = providers[0], providers[1]
        r1, r2 = results[p1], results[p2]
        header = f"{'Metric':<25} | {p1.capitalize() + ' Adapter':<24} | {p2.capitalize() + ' Adapter':<24}"
        divider = f"{'-'*25}-|-{'-'*24}-|-{'-'*24}"
        print(header)
        print(divider)

        rows = [
            ("Workload Operations", f"{r1['request_count']}", f"{r2['request_count']}"),
            ("Cache Hits", f"{r1['cache_hits']}", f"{r2['cache_hits']}"),
            ("Cache Misses", f"{r1['cache_misses']}", f"{r2['cache_misses']}"),
            ("Hit Ratio", f"{r1['hit_ratio']*100:.1f}%", f"{r2['hit_ratio']*100:.1f}%"),
            ("Average Latency", f"{r1['average_latency_ms']:.4f} ms", f"{r2['average_latency_ms']:.4f} ms"),
            ("p50 Latency (Median)", f"{r1['p50_latency_ms']:.4f} ms", f"{r2['p50_latency_ms']:.4f} ms"),
            ("p95 Latency (Tail)", f"{r1['p95_latency_ms']:.4f} ms", f"{r2['p95_latency_ms']:.4f} ms"),
            ("Total Duration", f"{r1['total_duration_s']:.4f} s", f"{r2['total_duration_s']:.4f} s"),
            ("Throughput", f"{r1['throughput_ops_sec']:,.0f} ops/sec", f"{r2['throughput_ops_sec']:,.0f} ops/sec"),
            ("Errors", f"{r1['errors']}", f"{r2['errors']}"),
        ]

        for label, v1, v2 in rows:
            print(f"{label:<25} | {v1:<24} | {v2:<24}")
    else:
        p1 = providers[0]
        r1 = results[p1]
        header = f"{'Metric':<25} | {p1.capitalize() + ' Adapter':<30}"
        divider = f"{'-'*25}-|-{'-'*30}"
        print(header)
        print(divider)

        rows = [
            ("Workload Operations", f"{r1['request_count']}"),
            ("Cache Hits", f"{r1['cache_hits']}"),
            ("Cache Misses", f"{r1['cache_misses']}"),
            ("Hit Ratio", f"{r1['hit_ratio']*100:.1f}%"),
            ("Average Latency", f"{r1['average_latency_ms']:.4f} ms"),
            ("p50 Latency (Median)", f"{r1['p50_latency_ms']:.4f} ms"),
            ("p95 Latency (Tail)", f"{r1['p95_latency_ms']:.4f} ms"),
            ("Total Duration", f"{r1['total_duration_s']:.4f} s"),
            ("Throughput", f"{r1['throughput_ops_sec']:,.0f} ops/sec"),
            ("Errors", f"{r1['errors']}"),
        ]

        for label, v1 in rows:
            print(f"{label:<25} | {v1:<30}")

    print("=" * 80)


def run_benchmark(backend: str, live: bool):
    mode_label = "Live Network Daemon Benchmark" if live else "Isolated Abstraction & Instrumentation Overhead Benchmark"
    targets = ["redis", "memcached"] if backend == "both" else [backend.lower().strip()]
    results = {}

    for name in targets:
        print(f"\n[Benchmark] Preparing {name.upper()} ({mode_label})...")
        if live:
            try:
                provider = ProviderFactory.create_provider({"backend": name})
                # Quick health check to ensure live daemon is reachable
                health = provider.health_check()
                if health.get("status") != "healthy":
                    print(f"  [ERROR] Live {name} service is not reachable at configured endpoint.")
                    provider.close()
                    continue
            except (CacheConnectionError, CacheError) as err:
                print(f"  [ERROR] Cannot connect to live {name} daemon: {err}")
                continue
        else:
            provider = create_simulated_backend(name)

        service = CacheService(provider=provider, namespace=f"bench_{name}")
        try:
            metrics = run_benchmark_workload(service)
            results[name] = metrics
        finally:
            service.close()

    if results:
        print_comparison_table(results, mode_label)
    else:
        print("\n[INFO] No benchmark results collected. If running with --live, ensure Redis (port 6379) or Memcached (port 11211) is active.")


def main():
    parser = argparse.ArgumentParser(description="Pluggable Caching Abstraction Benchmark Harness")
    parser.add_argument(
        "--backend",
        choices=["redis", "memcached", "both"],
        default="both",
        help="Target backend provider to benchmark (default: both)",
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Run against real live Redis/Memcached daemons instead of simulated in-memory harness",
    )
    args = parser.parse_args()
    run_benchmark(backend=args.backend, live=args.live)


if __name__ == "__main__":
    main()
