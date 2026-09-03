import React from 'react';
import { Cpu, Server, Box, Database, ArrowDown, Check } from 'lucide-react';

interface ArchitectureVisualizerProps {
  currentProvider: string;
  namespace?: string | null;
}

export const ArchitectureVisualizer: React.FC<ArchitectureVisualizerProps> = ({
  currentProvider,
  namespace,
}) => {
  const isRedis = currentProvider.toLowerCase() === 'redis';
  const isMemcached = currentProvider.toLowerCase() === 'memcached';

  return (
    <div className="card" style={{ background: 'var(--bg-card)' }}>
      <div className="card-header">
        <div className="card-title">
          <Cpu size={18} color="var(--accent-emerald)" />
          <span>Live Architecture Flow</span>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          Namespace: <span className="font-mono" style={{ color: 'var(--text-main)' }}>{namespace || 'default'}</span>
        </span>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0'
      }}>
        {/* Layer 1: Application */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1.25rem',
          background: 'var(--bg-card-alt)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--text-main)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          <Server size={14} color="var(--accent-blue)" />
          <span>Application Layer (FastAPI Client)</span>
        </div>

        <ArrowDown size={14} color="var(--text-dim)" />

        {/* Layer 2: Abstraction Coordinator (CacheService) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0.6rem 1.5rem',
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid var(--accent-blue)',
          borderRadius: '8px',
          fontSize: '0.85rem',
          boxShadow: '0 0 15px rgba(59, 130, 246, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#60a5fa' }}>
            <Box size={15} />
            <span>CacheService & ProviderFactory</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Strict UTF-8 Validation • Type-Preserving Serializer • Normalized Exceptions
          </span>
        </div>

        <ArrowDown size={14} color="var(--text-dim)" />

        {/* Layer 3: Providers (Redis vs Memcached) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.25rem',
          width: '100%',
          maxWidth: '550px'
        }}>
          {/* Redis Adapter Node */}
          <div style={{
            padding: '0.75rem',
            borderRadius: '8px',
            background: isRedis ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-input)',
            border: `1.5px solid ${isRedis ? 'var(--redis-color)' : 'var(--border-color)'}`,
            boxShadow: isRedis ? '0 0 20px rgba(239, 68, 68, 0.25)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: isRedis ? '#f87171' : 'var(--text-dim)' }}>
                <Database size={15} />
                <span>RedisAdapter</span>
              </div>
              {isRedis && (
                <span className="badge badge-redis" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                  <Check size={10} /> ACTIVE
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.7rem', color: isRedis ? '#fca5a5' : 'var(--text-dim)' }}>
              • ConnectionPool (Redis-Py)<br />
              • SCAN Pattern Invalidation
            </p>
          </div>

          {/* Memcached Adapter Node */}
          <div style={{
            padding: '0.75rem',
            borderRadius: '8px',
            background: isMemcached ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg-input)',
            border: `1.5px solid ${isMemcached ? 'var(--memcached-color)' : 'var(--border-color)'}`,
            boxShadow: isMemcached ? '0 0 20px rgba(6, 182, 212, 0.25)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: isMemcached ? '#22d3ee' : 'var(--text-dim)' }}>
                <Database size={15} />
                <span>MemcachedAdapter</span>
              </div>
              {isMemcached && (
                <span className="badge badge-memcached" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                  <Check size={10} /> ACTIVE
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.7rem', color: isMemcached ? '#67e8f9' : 'var(--text-dim)' }}>
              • PooledClient (PyMemcache)<br />
              • Epoch Versioning Invalidation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
