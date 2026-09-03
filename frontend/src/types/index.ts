export type BackendType = 'redis' | 'memcached';

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  provider: string;
  latency_ms?: number;
  details?: Record<string, any>;
}

export interface CacheInfoResponse {
  provider: string;
  namespace?: string | null;
}

export interface MetricsSnapshot {
  request_count: number;
  cache_hits: number;
  cache_misses: number;
  hit_ratio: number;
  sets: number;
  deletes: number;
  clears: number;
  errors: number;
  sample_size: number;
  average_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  active_provider: string;
  namespace?: string | null;
  metrics_enabled: boolean;
}

export interface CacheGetResponse {
  key: string;
  value: any;
  cached: boolean;
  provider: string;
}

export interface CachePutResponse {
  key: string;
  stored: boolean;
  ttl?: number | null;
  provider: string;
}

export interface CacheDeleteResponse {
  key: string;
  deleted: boolean;
  provider: string;
}

export interface CacheClearResponse {
  cleared: boolean;
  provider: string;
  namespace?: string | null;
}

export interface CacheSwitchResponse {
  status: string;
  provider: string;
  namespace?: string | null;
}

export interface ProductResponse {
  product_id: string;
  name: string;
  price: number;
  category: string;
  in_stock: boolean;
  last_updated: string;
  source: 'database' | 'cache';
  database_latency_ms?: number;
  cache_hits?: number;
}

export interface ActivityLogItem {
  id: string;
  timestamp: string;
  operation: 'GET' | 'SET' | 'DELETE' | 'CLEAR' | 'SWITCH' | 'HEALTH' | 'METRICS' | 'PRODUCT_GET' | 'PRODUCT_PUT';
  key?: string;
  provider: string;
  status: 'success' | 'error' | 'miss';
  latencyMs: number;
  isHit?: boolean;
  isCachedNone?: boolean;
  isMiss?: boolean;
  details?: string;
}

export interface OperationResult {
  success: boolean;
  operation: string;
  key?: string;
  statusCode?: number;
  latencyMs: number;
  provider?: string;
  data?: any;
  error?: string;
  isHit?: boolean;
  isCachedNone?: boolean;
  isMiss?: boolean;
}
