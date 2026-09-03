# Architectural Design: Pluggable Caching Abstraction Layer

## 1. System Architecture

```text
       +-------------------------------------------------------------+
       |             Application Layer / REST Client                 |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |                        CacheService                         |
       |  - Portable Key Validation (<=250 UTF-8 bytes, no ws/ctrl)  |
       |  - PortableJsonSerializer (type-tagged JSON + raw bytes)    |
       |  - Namespace Scoping & Disambiguated Cache Hit/Miss         |
       |  - Embedded Lightweight Observability & Latency Tracking    |
       +-------------------------------------------------------------+
                                      |
                                      v
       +-------------------------------------------------------------+
       |                    CacheProvider Contract                   |
       |  get(key), set(key, val, ttl), exists(key), delete(key),    |
       |  clear(namespace), health_check(), close()                  |
       +-------------------------------------------------------------+
                 |                                         |
                 v                                         v
+-----------------------------------+     +-----------------------------------+
|           RedisAdapter            |     |         MemcachedAdapter          |
| - ConnectionPool (max_conns)      |     | - PooledClient (max_pool_size)    |
| - SCAN batch deletion for clear() |     | - Epoch Versioning for clear()    |
| - ex=ttl relative seconds         |     | - Unix epoch translation for >30d |
| - Error normalization             |     | - Error normalization             |
+-----------------------------------+     +-----------------------------------+
                 |                                         |
                 v                                         v
+-----------------------------------+     +-----------------------------------+
|           Redis Server            |     |         Memcached Server          |
+-----------------------------------+     +-----------------------------------+
```

---

## 2. Core Architectural Invariants

### 1. Unified Contract (`CacheProvider`)
All adapters implement a stable contract operating on raw bytes:
- `get(key: str) -> Optional[bytes]`
- `set(key: str, value: bytes, ttl: Optional[int] = None) -> bool`
- `exists(key: str) -> bool`
- `delete(key: str) -> bool`
- `clear(namespace: Optional[str] = None) -> bool`
- `health_check() -> Dict[str, Any]`
- `close() -> None`

### 2. Namespace-Safe Clear Semantics
- **Redis**: Uses `SCAN` pattern matching (`f"{namespace}:*"`) and deletes matching keys in pipeline batches without calling destructive server-wide `FLUSHDB`.
- **Memcached**: Implements namespace epoch versioning (`_ns_ver:{namespace}`). Calling `clear(namespace)` increments the namespace version, instantly and safely invalidating all keys in that namespace in $O(1)$ time while leaving all other namespaces completely untouched.
- **Unscoped (`namespace=None`)**: Calls backend-wide flush (`flushdb()` / `flush_all()`).

### 3. Portable TTL Policy
- `ttl` parameter in `set()` represents a duration in seconds ($0 \le \text{ttl}$).
- `ttl = 0` guarantees immediate deletion / eviction across all backends.
- In Redis, `ex=ttl` is passed directly.
- In Memcached, relative durations $\le 2,592,000$ seconds (30 days) are passed as relative offsets; durations $> 2,592,000$ seconds are translated to absolute Unix epoch timestamps (`int(time.time() + ttl)`), preventing premature key expiration.

### 4. Cache Miss vs. Cached `None` Disambiguation
- In the serialization boundary, Python `None` is serialized as `b'{"t":"n","v":null}'`.
- A Cache Miss returns raw `None` from the provider.
- `CacheService.get_with_status(key)` returns `(False, None)` on cache miss, and `(True, None)` when `None` was explicitly cached.
- `CacheService.exists(key)` provides an explicit existence check.
- In the REST API, a Cache Miss returns `HTTP 404`, whereas a cached `None` returns `HTTP 200 {"key": key, "value": null, "cached": True}`.

### 5. Strict Key Validation
- Keys and namespaces must be non-empty strings.
- UTF-8 byte length cannot exceed 250 bytes (`len(key.encode('utf-8')) <= 250`).
- Whitespace (`\s`) and ASCII control characters (`\x00-\x1f\x7f`) are strictly rejected.

### 6. Concurrency & Lifecycle Safe Runtime Switching
- `api.py` manages active services using a `threading.RLock`.
- Pre-switch validation: Before switching providers, a health check is performed against the target backend. If unhealthy or unreachable, the switch is rejected with HTTP 503 and the existing healthy provider remains active.
- Retired providers are closed safely without race conditions.

### 7. Dual-Tier Testing Strategy
1. **Mocked Unit & Contract Tests** (Fast, deterministic, zero-infrastructure CI suite).
2. **Real Backend Integration Tests** (`tests/test_integration_real_backends.py` against live Redis 6379 and Memcached 11211).