import React from 'react';
import { History, Trash2 } from 'lucide-react';
import { ActivityLogItem } from '../types';

interface ActivityLogProps {
  logs: ActivityLogItem[];
  onClearLogs: () => void;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ logs, onClearLogs }) => {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <History size={18} color="var(--accent-blue)" />
          <span>Real-Time Activity Audit Trail</span>
        </div>
        <button
          className="btn btn-secondary"
          onClick={onClearLogs}
          disabled={logs.length === 0}
          style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
          title="Clear audit trail history"
        >
          <Trash2 size={12} /> Clear Log
        </button>
      </div>

      <div style={{
        background: 'var(--bg-input)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        maxHeight: '260px',
        overflowY: 'auto'
      }}>
        {logs.length === 0 ? (
          <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            No activity recorded yet. Cache operations will stream here in real time.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {logs.map((item) => {
              const isHit = item.isHit;
              const isMiss = item.isMiss;
              const isCachedNone = item.isCachedNone;
              const isError = item.status === 'error';

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: '0.75rem',
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="font-mono" style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>
                      {item.timestamp}
                    </span>

                    <span className="badge" style={{ background: '#1e293b', color: 'var(--text-main)', border: '1px solid #334155' }}>
                      {item.operation}
                    </span>

                    {item.key && (
                      <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                        {item.key}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {item.provider && (
                      <span className={`badge badge-${item.provider.toLowerCase()}`}>
                        {item.provider}
                      </span>
                    )}

                    {isCachedNone && (
                      <span className="badge badge-none">
                        CACHED NONE
                      </span>
                    )}

                    {isHit && !isCachedNone && (
                      <span className="badge badge-hit">
                        HIT
                      </span>
                    )}

                    {isMiss && (
                      <span className="badge badge-miss">
                        MISS (404)
                      </span>
                    )}

                    {isError && (
                      <span className="badge badge-error">
                        ERROR
                      </span>
                    )}

                    <span className="font-mono" style={{ color: 'var(--text-dim)', minWidth: '45px', textAlign: 'right' }}>
                      {item.latencyMs.toFixed(1)}ms
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
