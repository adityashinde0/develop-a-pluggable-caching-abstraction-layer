1. Problem Summary & Core Value Proposition
Applications become tightly coupled to Redis/Memcached when cache-specific APIs are used directly, making backend replacement costly and risky. Build a Python caching abstraction with one stable contract and interchangeable Redis/Memcached adapters selected through configuration. Wow: switch the cache engine without changing application-facing cache calls.
2. Assumptions
- "Runtime switching" means configuration-driven backend selection without code changes/recompilation; existing cache contents do not need live migration.
- The common API exposes only capabilities portable across Redis and Memcached; backend-specific features remain outside the core contract.
- Redis and Memcached are dedicated/available cache instances during the demo; no persistent database is required.
3. Personas & Key Journeys
- Application developer: calls one cache API for get/set/delete/clear; edge case: backend-specific behavior must not leak into application code.
- Operator: selects Redis or Memcached through configuration and restarts/reloads the service; edge case: invalid provider configuration must fail clearly.
- System maintainer: adds a new provider by implementing the contract; edge case: new adapters must pass the existing contract tests without changing application logic.
4. MVP Scope (Tier-1 only, 12h)
- Unified cache contract — common get, set, delete, clear, TTL and health semantics. [Technical Excellence]
- Redis adapter — production-oriented Redis client/pooling implementation behind the contract. [Feasibility]
- Memcached adapter — pymemcache implementation behind the same contract. [Feasibility]
- Configuration-driven provider selection — select backend without changing/recompiling application code. [Innovation]
- Normalized reliability layer — validation, serialization, timeouts/connection-error handling and provider-neutral errors. [Technical Excellence]
- Contract/API test & demo harness — identical tests and demo operations against both providers, including failure and TTL cases. [Usability]
Wishlist
- Provider latency/hit-miss metrics and comparison dashboard.
- Batch get/set operations.
- Capability discovery for optional provider-specific features.
- Additional adapter such as Valkey.
5. Success Metric
Both Redis and Memcached pass the same core contract test suite and the same demo workflow without application-level cache API changes.
6. Demo Script
- Run identical cache operations on Redis, change configuration, repeat on Memcached, then demonstrate TTL and controlled backend failure.
=== FILE: ARCHITECTURE.md ===