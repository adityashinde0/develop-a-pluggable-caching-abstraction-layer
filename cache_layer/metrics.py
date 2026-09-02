"""Lightweight metrics and observability collector for the cache layer."""

import math
import threading
import time
from collections import deque
from typing import Any, Dict, List, Optional


class MetricsCollector:
    """Thread-safe, lightweight metrics collector for cache operations."""

    def __init__(self, max_samples: int = 10000):
        self._lock = threading.Lock()
        self._max_samples = max_samples
        self._request_count = 0
        self._hits = 0
        self._misses = 0
        self._sets = 0
        self._deletes = 0
        self._clears = 0
        self._errors = 0
        self._latencies: deque = deque(maxlen=max_samples)

    def record_get(self, hit: bool, latency_ms: float) -> None:
        """Record a GET operation outcome and latency."""
        with self._lock:
            self._request_count += 1
            if hit:
                self._hits += 1
            else:
                self._misses += 1
            self._latencies.append(latency_ms)

    def record_set(self, latency_ms: float) -> None:
        """Record a SET operation and latency."""
        with self._lock:
            self._request_count += 1
            self._sets += 1
            self._latencies.append(latency_ms)

    def record_delete(self, latency_ms: float) -> None:
        """Record a DELETE operation and latency."""
        with self._lock:
            self._request_count += 1
            self._deletes += 1
            self._latencies.append(latency_ms)

    def record_clear(self, latency_ms: float) -> None:
        """Record a CLEAR operation and latency."""
        with self._lock:
            self._request_count += 1
            self._clears += 1
            self._latencies.append(latency_ms)

    def record_error(self, latency_ms: float = 0.0) -> None:
        """Record an error occurrence."""
        with self._lock:
            self._request_count += 1
            self._errors += 1
            if latency_ms > 0:
                self._latencies.append(latency_ms)

    def _calculate_percentile(self, sorted_data: List[float], percentile: float) -> float:
        """Calculate percentile value from sorted list of floats."""
        if not sorted_data:
            return 0.0
        k = (len(sorted_data) - 1) * percentile
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return round(sorted_data[int(k)], 3)
        d0 = sorted_data[int(f)] * (c - k)
        d1 = sorted_data[int(c)] * (k - f)
        return round(d0 + d1, 3)

    def get_snapshot(self) -> Dict[str, Any]:
        """Return a snapshot of current metrics."""
        with self._lock:
            total_lookups = self._hits + self._misses
            hit_ratio = round(self._hits / total_lookups, 4) if total_lookups > 0 else 0.0

            latencies_list = list(self._latencies)
            if latencies_list:
                avg_latency = round(sum(latencies_list) / len(latencies_list), 3)
                sorted_latencies = sorted(latencies_list)
                p50 = self._calculate_percentile(sorted_latencies, 0.50)
                p95 = self._calculate_percentile(sorted_latencies, 0.95)
            else:
                avg_latency = 0.0
                p50 = 0.0
                p95 = 0.0

            return {
                "request_count": self._request_count,
                "cache_hits": self._hits,
                "cache_misses": self._misses,
                "hit_ratio": hit_ratio,
                "sets": self._sets,
                "deletes": self._deletes,
                "clears": self._clears,
                "errors": self._errors,
                "average_latency_ms": avg_latency,
                "p50_latency_ms": p50,
                "p95_latency_ms": p95,
                "sample_size": len(latencies_list),
            }

    def reset(self) -> None:
        """Reset all metrics counters and latency buffers."""
        with self._lock:
            self._request_count = 0
            self._hits = 0
            self._misses = 0
            self._sets = 0
            self._deletes = 0
            self._clears = 0
            self._errors = 0
            self._latencies.clear()
