# Project Progress & Audit Log

## Completed Milestones

### 1. Core Abstraction & Adapters (P1)
- [x] Abstract `CacheProvider` contract with raw byte operations, `exists()`, and `clear(namespace)`.
- [x] Production-grade `RedisAdapter` with connection pooling, SCAN batch clear, and normalized error mapping.
- [x] Production-grade `MemcachedAdapter` with connection pooling, epoch versioning for namespace clearing, and TTL > 30-day epoch translation.
- [x] `PortableJsonSerializer` with explicit type tagging for primitives, dicts, lists, booleans vs ints, binary bytes, and `None`.
- [x] Normalized `CacheError` exception hierarchy.

### 2. Configuration & Provider Factory (P2)
- [x] `CacheConfig`, `RedisConfig`, `MemcachedConfig` with environment variable and dict parsing.
- [x] `ProviderFactory` with dynamic custom adapter registration and configuration injection.

### 3. Production Remediation & Invariant Hardening (P0 / P1)
- [x] **Namespace-Safe Clear Semantics**: Implemented SCAN batch delete in Redis and epoch versioning (`_ns_ver:<ns>`) in Memcached.
- [x] **TTL Portability**: Standardized relative seconds across backends; translated TTL > 30 days to Unix timestamp for Memcached.
- [x] **Cache Miss vs Cached None**: Disambiguated via `get_with_status()` and `exists()`.
- [x] **Byte-Length Key Validation**: Strict UTF-8 $\le 250$ byte length checks with whitespace/control character rejection.
- [x] **Runtime Switching Safety**: Added thread synchronization and target health check pre-validation in `api.py`.
- [x] **Real Backend Integration Test Suite**: Implemented `tests/test_integration_real_backends.py`.

### 4. Test Suite Summary
- Total Automated Tests: 49 items
- Unit & Contract Tests: 47 passed
- Real Backend Integration Tests: 2 skipped gracefully when daemons offline (100% pass when live daemons active).