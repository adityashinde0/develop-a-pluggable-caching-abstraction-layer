import React from 'react';
import { Database, ArrowRightLeft, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { BackendType } from '../types';

interface ProviderSwitcherProps {
  currentProvider: string;
  isSwitching: boolean;
  onSwitch: (backend: BackendType) => void;
  lastSwitchMessage: string | null;
  lastSwitchSuccess: boolean | null;
}

export const ProviderSwitcher: React.FC<ProviderSwitcherProps> = ({
  currentProvider,
  isSwitching,
  onSwitch,
  lastSwitchMessage,
  lastSwitchSuccess,
}) => {
  const isRedis = currentProvider.toLowerCase() === 'redis';
  const isMemcached = currentProvider.toLowerCase() === 'memcached';

  return (
    <div className="card" style={{
      background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-card-alt) 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div className="card-header">
        <div className="card-title">
          <ArrowRightLeft size={18} color="var(--accent-blue)" />
          <span>Active Backend Switcher</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          <ShieldCheck size={14} color="#34d399" />
          <span>Reference-Counted Draining</span>
        </div>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Exchange the underlying cache backend at runtime. In-flight requests safely drain without socket errors.
      </p>

      {/* Switcher Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: '0.75rem',
        alignItems: 'center',
        background: 'var(--bg-input)',
        padding: '0.75rem',
        borderRadius: '10px',
        border: '1px solid var(--border-color)'
      }}>
        {/* Redis Button */}
        <button
          className="btn"
          disabled={isSwitching || isRedis}
          onClick={() => onSwitch('redis')}
          style={{
            background: isRedis ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
            border: `1px solid ${isRedis ? 'var(--redis-color)' : 'var(--border-color)'}`,
            color: isRedis ? '#f87171' : 'var(--text-muted)',
            fontWeight: isRedis ? 700 : 500,
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={16} color={isRedis ? 'var(--redis-color)' : 'var(--text-dim)'} />
            <span style={{ fontSize: '0.95rem' }}>REDIS</span>
            {isRedis && <span className="status-dot healthy"></span>}
          </div>
          <span style={{ fontSize: '0.7rem', color: isRedis ? '#fca5a5' : 'var(--text-dim)' }}>
            {isRedis ? '● CURRENTLY ACTIVE' : 'Click to Switch'}
          </span>
        </button>

        {/* Middle Toggle Indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{
            padding: '0.4rem',
            borderRadius: '50%',
            background: 'var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ArrowRightLeft size={14} color="var(--text-muted)" />
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Zero Code Change
          </span>
        </div>

        {/* Memcached Button */}
        <button
          className="btn"
          disabled={isSwitching || isMemcached}
          onClick={() => onSwitch('memcached')}
          style={{
            background: isMemcached ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
            border: `1px solid ${isMemcached ? 'var(--memcached-color)' : 'var(--border-color)'}`,
            color: isMemcached ? '#22d3ee' : 'var(--text-muted)',
            fontWeight: isMemcached ? 700 : 500,
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={16} color={isMemcached ? 'var(--memcached-color)' : 'var(--text-dim)'} />
            <span style={{ fontSize: '0.95rem' }}>MEMCACHED</span>
            {isMemcached && <span className="status-dot healthy"></span>}
          </div>
          <span style={{ fontSize: '0.7rem', color: isMemcached ? '#67e8f9' : 'var(--text-dim)' }}>
            {isMemcached ? '● CURRENTLY ACTIVE' : 'Click to Switch'}
          </span>
        </button>
      </div>

      {/* Switch Status Notification */}
      {isSwitching && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '6px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.8rem',
          color: '#fbbf24'
        }}>
          <span className="status-dot switching"></span>
          <span>Validating target health & draining active in-flight requests...</span>
        </div>
      )}

      {!isSwitching && lastSwitchMessage && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '6px',
          background: lastSwitchSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
          border: `1px solid ${lastSwitchSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.8rem',
          color: lastSwitchSuccess ? '#34d399' : '#fb7185'
        }}>
          {lastSwitchSuccess ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          <span>{lastSwitchMessage}</span>
        </div>
      )}
    </div>
  );
};
