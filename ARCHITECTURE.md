1. System Flow
flowchart TD
    A[Application / API Client] --> B[Unified Cache Service]
    B --> C[Validate Request]
    C -->|Invalid| E[Return Validation Error]
    C -->|Valid| D[CacheProvider Contract]
    D --> F[Provider Factory / Configuration]
    F -->|Redis| G[Redis Adapter]
    F -->|Memcached| H[Memcached Adapter]
    G --> I[Redis Connection Pool]
    H --> J[Memcached Connection Pool]
    I --> K[Redis]
    J --> L[Memcached]
    K --> M[Normalize Result / Error]
    L --> M
    M --> N[Common Response]
    G -. connection/timeout .-> O[Normalized Cache Error]
    H -. connection/timeout .-> O
    O --> N
Core flow: request → validation → provider-neutral service → configured adapter → backend → normalized result/error. Provider selection is configuration-driven; changing providers does not change application-facing cache calls.
2. Data / Storage Design
- Cache data is stored directly in the selected Redis or Memcached backend.
- The abstraction owns key validation, optional namespace/prefix handling, TTL semantics and serialization boundaries.
- Use a portable value representation rather than exposing Redis-specific data structures through the common API.
- Connection pools manage concurrent backend access; adapter-specific client details remain isolated.
- PostgreSQL: Not required for this problem.
3. Core Interfaces
- CacheProvider → get(key), set(key, value, ttl), delete(key), clear(), health_check().
- RedisAdapter → implements CacheProvider using the Redis client/pool.
- MemcachedAdapter → implements CacheProvider using pymemcache/pool.
- CacheService → validation, serialization, provider invocation and normalized errors.
- ProviderFactory → validates configuration and creates the selected provider.
- Serializer → converts supported application values to/from the portable cache representation.
Auth: Not required for MVP.
4. User/System Interfaces
- GET /cache/{key} → retrieve value or report cache miss.
- PUT /cache/{key} → store value with optional TTL.
- DELETE /cache/{key} → remove one key.
- DELETE /cache → clear the configured cache store/namespace for the dedicated demo backend.
- GET /health → report abstraction/backend health.
- Configuration interface → CACHE_BACKEND=redis|memcached plus backend connection settings.
5. Fallback Strategy
- Invalid input/configuration → validation/startup detection → reject with explicit error; never silently choose another provider.
- Backend connection/timeout failure → adapter/client detects exception → return normalized cache error; do not expose provider-specific exceptions.
- Serialization/unsupported-value failure → serializer detects failure → reject operation cleanly without corrupting existing cache state.
6. Tech Debt Accepted
- Live migration of existing entries between providers is out of scope; switching providers may produce initial cache misses.
- Provider-specific advanced features are excluded from the portable MVP contract.
- Metrics/dashboard, batching and additional providers are deferred unless Tier-1 is stable.
=== FILE: PROGRESS.md ===