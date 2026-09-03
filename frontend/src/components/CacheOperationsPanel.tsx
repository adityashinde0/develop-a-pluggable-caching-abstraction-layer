import React, { useState } from 'react';
import { Play, Download, Trash2, Eraser, Check } from 'lucide-react';

interface CacheOperationsPanelProps {
  onGet: (key: string) => void;
  onSet: (key: string, value: any, ttl?: number | null) => void;
  onDelete: (key: string) => void;
  onClear: () => void;
  isLoading: boolean;
}

export const CacheOperationsPanel: React.FC<CacheOperationsPanelProps> = ({
  onGet,
  onSet,
  onDelete,
  onClear,
  isLoading,
}) => {
  const [key, setKey] = useState<string>('user:101:profile');
  const [valueStr, setValueStr] = useState<string>('{\n  "id": 101,\n  "name": "Sarah Connor",\n  "role": "admin",\n  "active": true\n}');
  const [ttl, setTtl] = useState<string>('60');

  const handleSet = () => {
    if (!key.trim()) return;

    let parsedValue: any = valueStr;
    try {
      parsedValue = JSON.parse(valueStr);
    } catch {
      // Keep as raw string if not valid JSON
      parsedValue = valueStr;
    }

    const parsedTtl = ttl.trim() === '' ? null : parseInt(ttl, 10);
    onSet(key.trim(), parsedValue, isNaN(parsedTtl as number) ? null : parsedTtl);
  };

  const handlePreset = (type: 'json' | 'string' | 'none' | 'bool' | 'number') => {
    switch (type) {
      case 'json':
        setKey('user:101:profile');
        setValueStr('{\n  "id": 101,\n  "name": "Sarah Connor",\n  "role": "admin",\n  "active": true\n}');
        setTtl('60');
        break;
      case 'string':
        setKey('session:token_981');
        setValueStr('jwt_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
        setTtl('300');
        break;
      case 'none':
        setKey('optional:feature_flag');
        setValueStr('null');
        setTtl('');
        break;
      case 'bool':
        setKey('system:maintenance_mode');
        setValueStr('false');
        setTtl('');
        break;
      case 'number':
        setKey('counter:login_attempts');
        setValueStr('42');
        setTtl('600');
        break;
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Play size={18} color="var(--accent-blue)" />
          <span>Cache Operations Console</span>
        </div>
        {/* Preset Helpers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginRight: '0.2rem' }}>Presets:</span>
          <button className="btn btn-secondary" onClick={() => handlePreset('json')} style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }}>
            JSON
          </button>
          <button className="btn btn-secondary" onClick={() => handlePreset('string')} style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }}>
            String
          </button>
          <button className="btn btn-secondary" onClick={() => handlePreset('none')} style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }}>
            null (None)
          </button>
          <button className="btn btn-secondary" onClick={() => handlePreset('bool')} style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }}>
            Bool
          </button>
          <button className="btn btn-secondary" onClick={() => handlePreset('number')} style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }}>
            Number
          </button>
        </div>
      </div>

      {/* Key Input */}
      <div className="input-group">
        <label className="input-label">
          <span>CACHE KEY (Max 250 bytes UTF-8, no spaces)</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{new Blob([key]).size} bytes</span>
        </label>
        <input
          type="text"
          className="input-control"
          placeholder="e.g. user:101:profile"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
      </div>

      {/* Value Input */}
      <div className="input-group">
        <label className="input-label">
          <span>VALUE (JSON Object, String, Number, Boolean, or null)</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Type-Preserved</span>
        </label>
        <textarea
          className="input-control"
          rows={4}
          placeholder="e.g. { ... } or plain text or null"
          value={valueStr}
          onChange={(e) => setValueStr(e.target.value)}
        />
      </div>

      {/* TTL Input */}
      <div className="input-group">
        <label className="input-label">
          <span>TIME-TO-LIVE (TTL in seconds)</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Empty = No expiry, 0 = Immediate delete</span>
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="number"
            min="0"
            className="input-control"
            placeholder="No expiration"
            value={ttl}
            onChange={(e) => setTtl(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn-secondary" onClick={() => setTtl('')} style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}>
            No TTL
          </button>
          <button className="btn btn-secondary" onClick={() => setTtl('5')} style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}>
            5s
          </button>
          <button className="btn btn-secondary" onClick={() => setTtl('60')} style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}>
            60s
          </button>
          <button className="btn btn-secondary" onClick={() => setTtl('0')} style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}>
            0s (Drop)
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginTop: '1rem' }}>
        <button
          className="btn btn-primary"
          onClick={handleSet}
          disabled={isLoading || !key.trim()}
          style={{ background: '#2563eb' }}
        >
          <Check size={14} /> SET
        </button>

        <button
          className="btn btn-primary"
          onClick={() => key.trim() && onGet(key.trim())}
          disabled={isLoading || !key.trim()}
          style={{ background: '#0284c7' }}
        >
          <Download size={14} /> GET
        </button>

        <button
          className="btn btn-danger"
          onClick={() => key.trim() && onDelete(key.trim())}
          disabled={isLoading || !key.trim()}
        >
          <Trash2 size={14} /> DELETE
        </button>

        <button
          className="btn btn-secondary"
          onClick={onClear}
          disabled={isLoading}
          style={{ borderColor: 'var(--border-color)', color: '#fb7185' }}
          title="Clear keys in active namespace"
        >
          <Eraser size={14} /> CLEAR
        </button>
      </div>
    </div>
  );
};
