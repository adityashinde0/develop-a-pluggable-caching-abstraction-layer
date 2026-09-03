import {
  BackendType,
  CacheClearResponse,
  CacheDeleteResponse,
  CacheGetResponse,
  CacheInfoResponse,
  CachePutResponse,
  CacheSwitchResponse,
  HealthResponse,
  MetricsSnapshot,
  OperationResult,
  ProductResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class CacheApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T | null; status: number; latencyMs: number; error: string | null }> {
    const url = `${this.baseUrl}${endpoint}`;
    const start = performance.now();
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      const latencyMs = Math.round((performance.now() - start) * 100) / 100;
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        return {
          data: json,
          status: res.status,
          latencyMs,
          error: json?.detail || json?.error || `HTTP ${res.status}: ${res.statusText}`,
        };
      }

      return { data: json, status: res.status, latencyMs, error: null };
    } catch (err: any) {
      const latencyMs = Math.round((performance.now() - start) * 100) / 100;
      return {
        data: null,
        status: 0,
        latencyMs,
        error: err?.message || 'Network connection failed. Ensure FastAPI server is running.',
      };
    }
  }

  // System Endpoints
  async getHealth(): Promise<{ data: HealthResponse | null; latencyMs: number; error: string | null }> {
    const res = await this.request<HealthResponse>('/health');
    return { data: res.data, latencyMs: res.latencyMs, error: res.error };
  }

  async getInfo(): Promise<{ data: CacheInfoResponse | null; latencyMs: number; error: string | null }> {
    const res = await this.request<CacheInfoResponse>('/cache/info');
    return { data: res.data, latencyMs: res.latencyMs, error: res.error };
  }

  async getMetrics(): Promise<{ data: MetricsSnapshot | null; latencyMs: number; error: string | null }> {
    const res = await this.request<MetricsSnapshot>('/cache/metrics');
    return { data: res.data, latencyMs: res.latencyMs, error: res.error };
  }

  async resetMetrics(): Promise<{ success: boolean; latencyMs: number }> {
    const res = await this.request<{ status: string }>('/cache/metrics/reset', { method: 'POST' });
    return { success: res.status === 200, latencyMs: res.latencyMs };
  }

  async switchBackend(
    backend: BackendType,
    namespace?: string
  ): Promise<OperationResult> {
    const body: Record<string, any> = { backend };
    if (namespace !== undefined) body.namespace = namespace;

    const res = await this.request<CacheSwitchResponse>('/cache/switch', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return {
      success: res.status === 200,
      operation: 'SWITCH',
      statusCode: res.status,
      latencyMs: res.latencyMs,
      provider: backend,
      data: res.data,
      error: res.error || undefined,
    };
  }

  // Cache Operations
  async get(key: string): Promise<OperationResult> {
    const res = await this.request<CacheGetResponse>(`/cache/${encodeURIComponent(key)}`);

    if (res.status === 200 && res.data) {
      const isNone = res.data.value === null;
      return {
        success: true,
        operation: 'GET',
        key,
        statusCode: 200,
        latencyMs: res.latencyMs,
        provider: res.data.provider,
        data: res.data,
        isHit: true,
        isCachedNone: isNone,
        isMiss: false,
      };
    }

    if (res.status === 404) {
      return {
        success: false,
        operation: 'GET',
        key,
        statusCode: 404,
        latencyMs: res.latencyMs,
        error: res.error || `Key '${key}' not found in cache`,
        isHit: false,
        isCachedNone: false,
        isMiss: true,
      };
    }

    return {
      success: false,
      operation: 'GET',
      key,
      statusCode: res.status,
      latencyMs: res.latencyMs,
      error: res.error || 'Failed to retrieve key',
      isHit: false,
      isCachedNone: false,
      isMiss: false,
    };
  }

  async set(key: string, value: any, ttl?: number | null): Promise<OperationResult> {
    const body: { value: any; ttl?: number } = { value };
    if (ttl !== undefined && ttl !== null && !isNaN(ttl)) {
      body.ttl = ttl;
    }

    const res = await this.request<CachePutResponse>(`/cache/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    return {
      success: res.status === 200,
      operation: 'SET',
      key,
      statusCode: res.status,
      latencyMs: res.latencyMs,
      provider: res.data?.provider,
      data: res.data,
      error: res.error || undefined,
    };
  }

  async delete(key: string): Promise<OperationResult> {
    const res = await this.request<CacheDeleteResponse>(`/cache/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });

    return {
      success: res.status === 200,
      operation: 'DELETE',
      key,
      statusCode: res.status,
      latencyMs: res.latencyMs,
      provider: res.data?.provider,
      data: res.data,
      error: res.error || undefined,
    };
  }

  async clear(): Promise<OperationResult> {
    const res = await this.request<CacheClearResponse>('/cache', {
      method: 'DELETE',
    });

    return {
      success: res.status === 200,
      operation: 'CLEAR',
      statusCode: res.status,
      latencyMs: res.latencyMs,
      provider: res.data?.provider,
      data: res.data,
      error: res.error || undefined,
    };
  }

  // E-Commerce Use Case Endpoints
  async getProduct(productId: string): Promise<OperationResult> {
    const res = await this.request<ProductResponse>(`/products/${encodeURIComponent(productId)}`);
    return {
      success: res.status === 200,
      operation: 'PRODUCT_GET',
      key: `prod:${productId}`,
      statusCode: res.status,
      latencyMs: res.latencyMs,
      data: res.data,
      error: res.error || undefined,
      isHit: res.data?.source === 'cache',
      isMiss: res.data?.source === 'database',
    };
  }

  async updateProductPrice(productId: string, price: number): Promise<OperationResult> {
    const res = await this.request<{ product_id: string; updated: boolean; new_price: number; cache_invalidated: boolean }>(
      `/products/${encodeURIComponent(productId)}/price`,
      {
        method: 'PUT',
        body: JSON.stringify({ price }),
      }
    );

    return {
      success: res.status === 200,
      operation: 'PRODUCT_PUT',
      key: `prod:${productId}`,
      statusCode: res.status,
      latencyMs: res.latencyMs,
      data: res.data,
      error: res.error || undefined,
    };
  }
}

export const cacheApi = new CacheApiClient();
