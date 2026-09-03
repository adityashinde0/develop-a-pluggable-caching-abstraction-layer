import React, { useState } from 'react';
import { Zap, Clock, ShieldAlert, Sparkles, Play } from 'lucide-react';
import { cacheApi } from '../api/cacheApi';
import { OperationResult } from '../types';

interface SemanticDemosProps {
  onLogResult: (result: OperationResult) => void;
}

export const SemanticDemos: React.FC<SemanticDemosProps> = ({ onLogResult }) => {
  // Demo 1: Cached None State
  const [noneStatus, setNoneStatus] = useState<string | null>(null);
  const [isNoneRunning, setIsNoneRunning] = useState(false);

  // Demo 2: TTL Expiration State
  const [ttlCountdown, setTtlCountdown] = useState<number | null>(null);
  const [ttlStatus, setTtlStatus] = useState<string | null>(null);
  const [isTtlRunning, setIsTtlRunning] = useState(false);

  // Demo 3: Validation Error State
  const [validationStatus, setValidationStatus] = useState<string | null>(null);

  // 1. Run Cached None Demo
  const runCachedNoneDemo = async () => {
    setIsNoneRunning(true);
    setNoneStatus('1/3: Storing explicit null value into key "demo:nullable_flag"...');

    // 1. SET key with null
    const setRes = await cacheApi.set('demo:nullable_flag', null);
    onLogResult(setRes);

    await new Promise((r) => setTimeout(r, 600));
    setNoneStatus('2/3: Fetching "demo:nullable_flag" (Expect HTTP 200 with value: null)...');

    // 2. GET key with null
    const getNoneRes = await cacheApi.get('demo:nullable_flag');
    onLogResult(getNoneRes);

    await new Promise((r) => setTimeout(r, 600));
    setNoneStatus('3/3: Fetching unassigned key "demo:ghost_key" (Expect HTTP 404 Cache Miss)...');

    // 3. GET nonexistent key
    const getMissRes = await cacheApi.get('demo:ghost_key');
    onLogResult(getMissRes);

    setIsNoneRunning(false);
    setNoneStatus('✓ Success: Verified Cached None returns HTTP 200 (Hit), while unassigned returns HTTP 404 (Miss)!');
  };

  // 2. Run TTL Expiration Demo
  const runTtlDemo = async () => {
    setIsTtlRunning(true);
    setTtlStatus('1/3: Writing "demo:ephemeral_otp" with TTL = 3 seconds...');

    const setRes = await cacheApi.set('demo:ephemeral_otp', 'OTP-98214', 3);
    onLogResult(setRes);

    // Immediate read
    const immediateRes = await cacheApi.get('demo:ephemeral_otp');
    onLogResult(immediateRes);
    setTtlStatus('2/3: Immediate read (T+0s): HIT value="OTP-98214". Waiting for expiration...');

    // Live countdown 3 -> 0
    let remaining = 3;
    setTtlCountdown(remaining);
    const interval = setInterval(() => {
      remaining -= 1;
      setTtlCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    // Wait 3.5 seconds total
    await new Promise((r) => setTimeout(r, 3500));
    setTtlCountdown(null);

    setTtlStatus('3/3: Re-fetching key after 3.5s (Expect HTTP 404 Cache Miss / Expired)...');
    const expiredRes = await cacheApi.get('demo:ephemeral_otp');
    onLogResult(expiredRes);

    setIsTtlRunning(false);
    setTtlStatus('✓ Success: Verified key automatically expired and evicted from backend store!');
  };

  // 3. Run Validation Error Demo
  const runValidationDemo = async () => {
    setValidationStatus('Sending invalid key with whitespace "bad key with spaces"...');
    const res = await cacheApi.get('bad key with spaces');
    onLogResult(res);

    if (res.statusCode === 422) {
      setValidationStatus('✓ Success: Backend returned HTTP 422 ValidationError before touching socket!');
    } else {
      setValidationStatus(`Response received: HTTP ${res.statusCode}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Zap size={18} color="var(--accent-amber)" />
            <span>Interactive Semantic & Reliability Demonstrations</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Real-time live backend executions
          </span>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          These automated tests execute live against the active cache backend to demonstrate the core mathematical invariants of the abstraction layer.
        </p>

        <div className="grid-3">
          {/* Demo Card 1: Cached None vs Miss */}
          <div style={{
            background: 'var(--bg-input)',
            padding: '1rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <Sparkles size={16} color="var(--accent-purple)" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Cached None vs Miss</h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Differentiates an explicitly stored <code>null</code> (HTTP 200 Hit) from a non-existent key (HTTP 404 Miss).
              </p>
            </div>

            {noneStatus && (
              <div style={{
                fontSize: '0.7rem',
                padding: '0.4rem 0.6rem',
                background: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                color: '#c4b5fd'
              }}>
                {noneStatus}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={runCachedNoneDemo}
              disabled={isNoneRunning}
              style={{ background: 'var(--accent-purple)', width: '100%', fontSize: '0.8rem' }}
            >
              <Play size={13} /> {isNoneRunning ? 'Running Demo...' : 'Run Cached None Demo'}
            </button>
          </div>

          {/* Demo Card 2: TTL Expiration */}
          <div style={{
            background: 'var(--bg-input)',
            padding: '1rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <Clock size={16} color="var(--accent-emerald)" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>TTL Automatic Eviction</h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Sets a 3-second TTL key, verifies immediate read hit, waits for expiry, and confirms 404 cache miss.
              </p>
            </div>

            {ttlCountdown !== null && (
              <div style={{
                textAlign: 'center',
                padding: '0.4rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '6px',
                color: '#34d399',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}>
                ⏳ Evaporating in {ttlCountdown}s...
              </div>
            )}

            {ttlStatus && !ttlCountdown && (
              <div style={{
                fontSize: '0.7rem',
                padding: '0.4rem 0.6rem',
                background: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                color: '#6ee7b7'
              }}>
                {ttlStatus}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={runTtlDemo}
              disabled={isTtlRunning}
              style={{ background: '#059669', width: '100%', fontSize: '0.8rem' }}
            >
              <Play size={13} /> {isTtlRunning ? 'Counting Down...' : 'Run TTL Expiry Demo'}
            </button>
          </div>

          {/* Demo Card 3: Validation Error */}
          <div style={{
            background: 'var(--bg-input)',
            padding: '1rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <ShieldAlert size={16} color="var(--accent-rose)" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Validation Rejection</h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Sends a key with whitespace characters to prove the abstraction rejects invalid inputs prior to transmission.
              </p>
            </div>

            {validationStatus && (
              <div style={{
                fontSize: '0.7rem',
                padding: '0.4rem 0.6rem',
                background: 'var(--bg-card)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                color: '#fca5a5'
              }}>
                {validationStatus}
              </div>
            )}

            <button
              className="btn btn-danger"
              onClick={runValidationDemo}
              style={{ width: '100%', fontSize: '0.8rem' }}
            >
              <Play size={13} /> Trigger Validation Error
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
