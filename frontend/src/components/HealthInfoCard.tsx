import React from 'react';
import { Activity, Radio, BarChart3, Clock, RotateCcw } from 'lucide-react';
import { HealthResponse, MetricsSnapshot } from '../types';

interface HealthInfoCardProps {
  health: HealthResponse | null;
  metrics: MetricsSnapshot | null;
  onResetMetrics: () => void;
  isResetting: boolean;
}

export const HealthInfoCard: React.FC<HealthInfoCardProps> = ({
  health,
  metrics,
  onResetMetrics,
  isResetting,
}) => {
  const isHealthy = health?.status === 'healthy';
  const provider = health?.provider || 'unknown';
  const details = health?.details || {};

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Activity size={18} color="var(--accent-blue)" />
          <span>Backend Health & Telemetry</span>
        </div>
        <button
          className="btn btn-secondary"
          onClick={onResetMetrics}
          disabled={isResetting}
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          title="Reset metrics counters"
        >
          <RotateCcw size={12} /> Reset Metrics
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
        {/* Metric 1: Health Status */}
        <div style={{
          background: 'var(--bg-input)',
          padding: '0.75rem',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
            <Radio size={13} />
            <span>STATUS</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
            <span className={`status-dot ${isHealthy ? 'healthy' : 'unhealthy'}`}></span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isHealthy ? '#34d399' : '#fb7185' }}>
              {isHealthy ? 'HEALTHY' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Metric 2: Health Latency */}
        <div style={{
          background: 'var(--bg-input)',
          padding: '0.75rem',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
            <Clock size={13} />
            <span>PING LATENCY</span>
          </div>
          <div className="font-mono" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', marginTop: '0.35rem' }}>
            {health?.latency_ms !== undefined ? `${health.latency_ms.toFixed(2)} ms` : 'N/A'}
          </div>
        </div>

        {/* Metric 3: Hit Ratio */}
        <div style={{
          background: 'var(--bg-input)',
          padding: '0.75rem',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
            <BarChart3 size={13} />
            <span>HIT RATIO</span>
          </div>
          <div className="font-mono" style={{
            fontWeight: 700,
            fontSize: '1rem',
            color: metrics && metrics.hit_ratio > 0.6 ? '#34d399' : '#fbbf24',
            marginTop: '0.35rem'
          }}>
            {metrics ? `${(metrics.hit_ratio * 100).toFixed(1)}%` : '0.0%'}
          </div>
        </div>

        {/* Metric 4: Tail Latency (p95) */}
        <div style={{
          background: 'var(--bg-input)',
          padding: '0.75rem',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
            <Clock size={13} />
            <span>TAIL (p95)</span>
          </div>
          <div className="font-mono" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', marginTop: '0.35rem' }}>
            {metrics ? `${metrics.p95_latency_ms.toFixed(2)} ms` : '0.00 ms'}
          </div>
        </div>
      </div>

      {/* Backend Details Footer */}
      <div style={{
        marginTop: '0.75rem',
        paddingTop: '0.6rem',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.75rem',
        color: 'var(--text-dim)',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div>
          <span>Target Host: </span>
          <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
            {details.host || '127.0.0.1'}:{details.port || (provider === 'redis' ? '6379' : '11211')}
          </span>
        </div>
        <div>
          <span>Hits: </span>
          <span className="font-mono" style={{ color: '#34d399' }}>{metrics?.cache_hits || 0}</span>
          <span style={{ margin: '0 0.35rem' }}>•</span>
          <span>Misses: </span>
          <span className="font-mono" style={{ color: '#fbbf24' }}>{metrics?.cache_misses || 0}</span>
          <span style={{ margin: '0 0.35rem' }}>•</span>
          <span>Sets: </span>
          <span className="font-mono" style={{ color: '#60a5fa' }}>{metrics?.sets || 0}</span>
        </div>
      </div>
    </div>
  );
};
