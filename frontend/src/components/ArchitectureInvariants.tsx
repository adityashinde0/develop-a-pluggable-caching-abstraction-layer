import React from 'react';
import { ShieldCheck, CheckCircle, Layers } from 'lucide-react';

export const ArchitectureInvariants: React.FC = () => {
  const guarantees = [
    { title: 'Provider Abstraction', desc: 'Unified CacheProvider ABC with identical CRUD semantics across Redis and Memcached.' },
    { title: 'Cached None vs Miss', desc: 'Type-preserving serializer returns HTTP 200 for cached null vs HTTP 404 for cache misses.' },
    { title: 'Namespace-Safe Clear', desc: 'Redis uses SCAN batch delete; Memcached uses epoch versioning (_ns_ver:X).' },
    { title: 'TTL Portability', desc: 'Standard relative seconds contract; translates >30-day TTLs to absolute Unix timestamps for Memcached.' },
    { title: 'Key Byte Constraints', desc: 'Strict UTF-8 key validation enforcing wire protocol limit of 250 bytes without whitespace.' },
    { title: 'Safe Runtime Switch', desc: 'ServiceManager active reference-counting ensures in-flight requests drain before backend socket retirement.' },
    { title: 'Normalized Error Hierarchy', desc: 'Maps connection errors, timeouts, and validation failures into unified CacheError domain classes.' },
    { title: 'Connection Pooling', desc: 'Production-ready pooled connections for both redis-py (ConnectionPool) and pymemcache (PooledClient).' },
    { title: 'Universal Contract Tests', desc: 'Exact same 12-scenario pytest contract suite executes identically against all provider implementations.' },
    { title: 'Configuration Factory', desc: 'Environment-variable and dictionary-driven factory with zero application code changes required.' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Problem / Solution Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Layers size={18} color="var(--accent-blue)" />
            <span>Why This Project Matters</span>
          </div>
        </div>
        <div className="grid-3">
          <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ color: '#fb7185', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              THE PROBLEM
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Direct backend-specific caching calls couple application code to vendor APIs, making backend migrations complex and prone to subtle serialization or TTL defects.
            </p>
          </div>

          <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              THE SOLUTION
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              A robust, configuration-driven caching abstraction layer that normalizes wire protocols, exceptions, TTLs, and namespace invalidation under one stable contract.
            </p>
          </div>

          <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              THE RESULT
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Zero application code changes when switching between Redis and Memcached. Deterministic reliability, sub-millisecond overhead, and portable semantics.
            </p>
          </div>
        </div>
      </div>

      {/* Verified Guarantees Grid */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldCheck size={18} color="var(--accent-emerald)" />
            <span>Core Technical Guarantees (Verified by 50 Automated Tests)</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
          {guarantees.map((g, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-input)',
                padding: '0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                gap: '0.65rem'
              }}
            >
              <CheckCircle size={16} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{g.title}</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{g.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
