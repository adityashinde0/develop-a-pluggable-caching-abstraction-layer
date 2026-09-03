import React from 'react';
import { Layers, Activity, RefreshCw, Zap, ShoppingBag, Code, Compass, Box } from 'lucide-react';
import { HealthResponse, MetricsSnapshot } from '../types';

export type TabType = 'console' | 'tour' | '3d' | 'semantics' | 'ecommerce' | 'architecture';

interface HeaderProps {
  health: HealthResponse | null;
  metrics: MetricsSnapshot | null;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  metrics,
  activeTab,
  setActiveTab,
  onRefresh,
  isRefreshing,
}) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="card" style={{ padding: '1rem 1.25rem', marginBottom: '0.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Brand & Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            padding: '0.65rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)'
          }}>
            <Layers size={22} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                CacheFlow
              </h1>
              <span className="badge" style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>
                v1.0 Hackathon Freeze
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Pluggable Caching Abstraction Layer • <span style={{ color: 'var(--redis-color)', fontWeight: 600 }}>Redis</span> ⇄ <span style={{ color: 'var(--memcached-color)', fontWeight: 600 }}>Memcached</span>
            </p>
          </div>
        </div>

        {/* Live System Status & Quick Metrics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {metrics && (
            <div style={{
              display: 'flex',
              gap: '1.25rem',
              padding: '0.4rem 0.8rem',
              background: 'var(--bg-input)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '0.75rem'
            }}>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Ops: </span>
                <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{metrics.request_count}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Hit Ratio: </span>
                <span className="font-mono" style={{ fontWeight: 600, color: metrics.hit_ratio > 0.6 ? '#34d399' : '#fbbf24' }}>
                  {(metrics.hit_ratio * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>p50: </span>
                <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{metrics.p50_latency_ms.toFixed(2)}ms</span>
              </div>
            </div>
          )}

          {/* Health Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.75rem',
            background: isHealthy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            border: `1px solid ${isHealthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            borderRadius: '8px',
            fontSize: '0.8rem'
          }}>
            <span className={`status-dot ${isHealthy ? 'healthy' : 'unhealthy'}`}></span>
            <span style={{ fontWeight: 600, color: isHealthy ? '#34d399' : '#fb7185' }}>
              {isHealthy ? 'SYSTEM HEALTHY' : 'OFFLINE'}
            </span>
            {health?.latency_ms !== undefined && (
              <span className="font-mono" style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                ({health.latency_ms.toFixed(1)}ms)
              </span>
            )}
          </div>

          <button
            className="btn btn-secondary"
            onClick={onRefresh}
            disabled={isRefreshing}
            style={{ padding: '0.45rem 0.7rem' }}
            title="Refresh status & metrics"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', overflowX: 'auto' }}>
        <button
          className={`btn ${activeTab === 'console' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('console')}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.825rem' }}
        >
          <Activity size={14} /> Core Console
        </button>

        <button
          className={`btn ${activeTab === '3d' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('3d')}
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.825rem',
            background: activeTab === '3d' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : undefined,
            borderColor: activeTab === '3d' ? undefined : '#38bdf8'
          }}
        >
          <Box size={14} color={activeTab === '3d' ? '#fff' : '#38bdf8'} /> 3D Architecture Visualizer
        </button>

        <button
          className={`btn ${activeTab === 'tour' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('tour')}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.825rem', borderColor: activeTab === 'tour' ? undefined : 'var(--accent-purple)' }}
        >
          <Compass size={14} /> Guided Judge Tour
        </button>

        <button
          className={`btn ${activeTab === 'semantics' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('semantics')}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.825rem' }}
        >
          <Zap size={14} /> Semantic & TTL Demos
        </button>

        <button
          className={`btn ${activeTab === 'ecommerce' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('ecommerce')}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.825rem' }}
        >
          <ShoppingBag size={14} /> Real-World E-Commerce Use Case
        </button>

        <button
          className={`btn ${activeTab === 'architecture' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('architecture')}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.825rem' }}
        >
          <Code size={14} /> Invariants & Specifications
        </button>
      </div>
    </header>
  );
};
