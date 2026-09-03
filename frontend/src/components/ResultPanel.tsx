import React, { useState } from 'react';
import { Terminal, CheckCircle, AlertTriangle, HelpCircle, Copy, Check } from 'lucide-react';
import { OperationResult } from '../types';

interface ResultPanelProps {
  result: OperationResult | null;
  isLoading: boolean;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({ result, isLoading }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result.data || result.error, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div className="card-title">
          <Terminal size={18} color="var(--accent-purple)" />
          <span>Operation Result Inspector</span>
        </div>
        {result && (
          <button
            className="btn btn-secondary"
            onClick={handleCopy}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
            title="Copy response payload"
          >
            {copied ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy JSON'}</span>
          </button>
        )}
      </div>

      {isLoading && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '2rem 0',
          color: 'var(--text-muted)'
        }}>
          <span className="status-dot switching" style={{ width: '12px', height: '12px' }}></span>
          <span style={{ fontSize: '0.85rem' }}>Executing operation against cache provider...</span>
        </div>
      )}

      {!isLoading && !result && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '2rem 0',
          color: 'var(--text-dim)',
          textAlign: 'center'
        }}>
          <HelpCircle size={32} strokeWidth={1.5} />
          <p style={{ fontSize: '0.85rem' }}>No recent operation.</p>
          <span style={{ fontSize: '0.75rem' }}>Execute a GET, SET, or switch backends to view live response telemetry.</span>
        </div>
      )}

      {!isLoading && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
          {/* Header Metadata Pills */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            padding: '0.6rem 0.75rem',
            background: 'var(--bg-input)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="badge" style={{ background: '#1e293b', color: 'var(--text-main)', border: '1px solid #334155' }}>
                {result.operation}
              </span>

              {result.provider && (
                <span className={`badge badge-${result.provider.toLowerCase()}`}>
                  {result.provider}
                </span>
              )}

              {/* Status Outcome Badges */}
              {result.isCachedNone && (
                <span className="badge badge-none" title="Key exists with explicit null value (HTTP 200)">
                  <CheckCircle size={11} /> CACHED NONE (HIT)
                </span>
              )}

              {result.isHit && !result.isCachedNone && (
                <span className="badge badge-hit">
                  <CheckCircle size={11} /> CACHE HIT
                </span>
              )}

              {result.isMiss && (
                <span className="badge badge-miss">
                  <AlertTriangle size={11} /> CACHE MISS (404)
                </span>
              )}

              {result.statusCode && result.statusCode >= 400 && !result.isMiss && (
                <span className="badge badge-error">
                  HTTP {result.statusCode}
                </span>
              )}
            </div>

            <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Latency: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{result.latencyMs.toFixed(2)} ms</span>
            </div>
          </div>

          {/* Semantic Explanation Note (if Cached None or Miss) */}
          {result.isCachedNone && (
            <div style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              fontSize: '0.75rem',
              color: '#c4b5fd'
            }}>
              💡 <strong>Semantic Guarantee</strong>: Key exists in cache with value <code>null</code>. The abstraction returns <strong>HTTP 200</strong>, correctly distinguishing it from a 404 cache miss.
            </div>
          )}

          {result.isMiss && (
            <div style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              fontSize: '0.75rem',
              color: '#fde68a'
            }}>
              ⚠️ <strong>Cache Miss</strong>: Key was not found in active cache store. Returned <strong>HTTP 404</strong>.
            </div>
          )}

          {/* Raw JSON Display */}
          <div style={{
            flex: 1,
            background: 'var(--bg-input)',
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            overflowX: 'auto',
            maxHeight: '260px'
          }}>
            <pre className="font-mono" style={{
              fontSize: '0.8rem',
              color: result.error ? '#fb7185' : '#e2e8f0',
              lineHeight: 1.4
            }}>
              {result.error
                ? JSON.stringify({ error: result.error, status_code: result.statusCode }, null, 2)
                : JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
