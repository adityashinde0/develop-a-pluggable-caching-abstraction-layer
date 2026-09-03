import React, { useState } from 'react';
import {
  Box,
  Play,
  ArrowRightLeft,
  RotateCcw,
  Sliders,
  Award,
  Layers,
  Info,
  CheckCircle,
  HelpCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ThreeArchitectureScene, ArchitectureNodeInfo, NODE_DEFINITIONS } from './ThreeArchitectureScene';
import { ArchitectureVisualizer as Architecture2DFallback } from './ArchitectureVisualizer';
import { cacheApi } from '../api/cacheApi';
import { BackendType, OperationResult } from '../types';

interface ThreeArchitectureVisualizerProps {
  currentProvider: string;
  onSwitchProvider: (backend: BackendType) => Promise<void>;
  onLogResult: (result: OperationResult) => void;
  namespace?: string | null;
}

export const ThreeArchitectureVisualizer: React.FC<ThreeArchitectureVisualizerProps> = ({
  currentProvider,
  onSwitchProvider,
  onLogResult,
  namespace,
}) => {
  // View states
  const [isTechnicalView, setIsTechnicalView] = useState<boolean>(true);
  const [is2DFallback, setIs2DFallback] = useState<boolean>(false);
  const [isJudgeMode, setIsJudgeMode] = useState<boolean>(false);
  const [judgeStep, setJudgeStep] = useState<number>(1);
  const [selectedNode, setSelectedNode] = useState<ArchitectureNodeInfo>(NODE_DEFINITIONS.service);

  // Request Flow Animation state
  const [activePacketStep, setActivePacketStep] = useState<number | null>(null);
  const [packetStatusText, setPacketStatusText] = useState<string | null>(null);
  const [isFlowRunning, setIsFlowRunning] = useState<boolean>(false);

  // Reset Camera Callback
  const [resetCameraFn, setResetCameraFn] = useState<(() => void) | null>(null);

  const isRedis = currentProvider.toLowerCase() === 'redis';

  // 1. Trigger Animated Request Flow
  const handleDemonstrateRequest = async () => {
    setIsFlowRunning(true);

    // Step 0: Application issues GET
    setActivePacketStep(0);
    setPacketStatusText('1/5: Application calls cache.get("product:101")');
    await new Promise((r) => setTimeout(r, 600));

    // Step 1: FastAPI boundary
    setActivePacketStep(1);
    setPacketStatusText('2/5: FastAPI maps HTTP GET /cache/product:101');
    await new Promise((r) => setTimeout(r, 600));

    // Step 2: CacheService abstraction
    setActivePacketStep(2);
    setPacketStatusText('3/5: CacheService validates UTF-8 key & resolves namespace');
    await new Promise((r) => setTimeout(r, 700));

    // Step 3: CacheProvider contract dispatch
    setActivePacketStep(3);
    setPacketStatusText(`4/5: CacheProvider dispatches to ${currentProvider.toUpperCase()} Adapter`);
    await new Promise((r) => setTimeout(r, 600));

    // Step 4 & 5: Active Backend execution (Real API call)
    setActivePacketStep(4);
    setPacketStatusText(`5/5: Executing wire read on ${currentProvider.toUpperCase()} backend...`);
    const apiRes = await cacheApi.get('product:101');
    onLogResult(apiRes);

    setActivePacketStep(5);
    await new Promise((r) => setTimeout(r, 500));

    // Step 6: Return payload up to application
    setActivePacketStep(6);
    setPacketStatusText(`✓ SUCCESS: ${apiRes.isHit ? 'CACHE HIT' : 'CACHE MISS'} returned in ${apiRes.latencyMs}ms!`);
    await new Promise((r) => setTimeout(r, 1200));

    setActivePacketStep(null);
    setPacketStatusText(null);
    setIsFlowRunning(false);
  };

  // 2. Switch Backend
  const handleSwitch = async () => {
    const target: BackendType = isRedis ? 'memcached' : 'redis';
    await onSwitchProvider(target);
  };

  // 3. Judge Mode Steps
  const judgeSteps = [
    {
      step: 1,
      title: 'ONE STABLE APPLICATION CONTRACT',
      desc: 'The application layer interacts exclusively with CacheService. Application code has ZERO knowledge of Redis or Memcached.',
      focusNode: NODE_DEFINITIONS.app,
    },
    {
      step: 2,
      title: 'CENTRAL ABSTRACTION COORDINATOR',
      desc: 'CacheService coordinates key length validation (<=250 bytes), JSON/primitive type preservation, and normalized error models.',
      focusNode: NODE_DEFINITIONS.service,
    },
    {
      step: 3,
      title: 'POLYMORPHIC PROVIDER CONTRACT',
      desc: 'CacheProvider ABC defines the standard interface. RedisAdapter and MemcachedAdapter implement the exact same contract.',
      focusNode: NODE_DEFINITIONS.provider,
    },
    {
      step: 4,
      title: 'ZERO-DOWNTIME RUNTIME SWITCHING',
      desc: 'Providers can be swapped at runtime with active request draining. In-flight requests complete cleanly on the retiring backend.',
      focusNode: isRedis ? NODE_DEFINITIONS.redis_adapter : NODE_DEFINITIONS.memcached_adapter,
    },
    {
      step: 5,
      title: 'PORTABLE RELIABILITY & PERFORMANCE',
      desc: 'Same application code. Same cache semantics. Sub-millisecond latency across both interchangeable physical backends.',
      focusNode: isRedis ? NODE_DEFINITIONS.redis_backend : NODE_DEFINITIONS.memcached_backend,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Visualizer Container Card */}
      <div className="card">
        {/* Header & Controls Toolbar */}
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="card-title">
            <Box size={18} color="var(--accent-blue)" />
            <span>Interactive 3D Architecture Visualizer</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Simple vs Technical View Toggle */}
            <button
              className={`btn ${isTechnicalView ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setIsTechnicalView(!isTechnicalView)}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
            >
              <Sliders size={13} /> {isTechnicalView ? 'Technical View' : 'Simple View'}
            </button>

            {/* Demonstrate Request */}
            <button
              className="btn btn-primary"
              onClick={handleDemonstrateRequest}
              disabled={isFlowRunning}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
              }}
            >
              <Play size={13} /> {isFlowRunning ? 'Simulating Flow...' : 'Demonstrate Request Flow'}
            </button>

            {/* Switch Provider */}
            <button
              className="btn btn-secondary"
              onClick={handleSwitch}
              disabled={isFlowRunning}
              style={{
                borderColor: isRedis ? 'var(--memcached-color)' : 'var(--redis-color)',
                color: isRedis ? '#22d3ee' : '#f87171',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
              }}
            >
              <ArrowRightLeft size={13} /> Switch to {isRedis ? 'Memcached' : 'Redis'}
            </button>

            {/* Judge Mode Stepper Toggle */}
            <button
              className={`btn ${isJudgeMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setIsJudgeMode(!isJudgeMode)}
              style={{
                background: isJudgeMode ? 'var(--accent-purple)' : undefined,
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
              }}
            >
              <Award size={13} /> Judge Mode
            </button>

            {/* Reset Camera */}
            {!is2DFallback && resetCameraFn && (
              <button
                className="btn btn-secondary"
                onClick={resetCameraFn}
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                title="Reset 3D camera position"
              >
                <RotateCcw size={13} /> Reset View
              </button>
            )}

            {/* 2D / 3D Fallback Toggle */}
            <button
              className="btn btn-secondary"
              onClick={() => setIs2DFallback(!is2DFallback)}
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
              title="Toggle 2D fallback diagram"
            >
              {is2DFallback ? <Eye size={13} /> : <EyeOff size={13} />}
              <span>{is2DFallback ? '3D View' : '2D Diagram'}</span>
            </button>
          </div>
        </div>

        {/* Persistent "SAME APPLICATION API" Banner */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.6rem 1rem',
          background: 'linear-gradient(90deg, rgba(30, 58, 138, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)',
          borderRadius: '8px',
          border: '1px solid var(--accent-blue)',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Layers size={16} color="#60a5fa" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#93c5fd' }}>
              STABLE APPLICATION API:
            </span>
            <code className="font-mono" style={{ background: '#0b1329', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#38bdf8', fontSize: '0.8rem' }}>
              cache.get(k) • cache.set(k, v, ttl) • cache.delete(k)
            </code>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Active Backend: <span className={`badge badge-${currentProvider.toLowerCase()}`}>{currentProvider.toUpperCase()}</span>
          </div>
        </div>

        {/* Judge Mode Guided Step Bar */}
        {isJudgeMode && (
          <div style={{
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                background: 'var(--accent-purple)',
                color: '#fff',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}>
                {judgeStep}
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c4b5fd' }}>
                  {judgeSteps[judgeStep - 1].title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {judgeSteps[judgeStep - 1].desc}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                className="btn btn-secondary"
                disabled={judgeStep <= 1}
                onClick={() => {
                  const next = judgeStep - 1;
                  setJudgeStep(next);
                  setSelectedNode(judgeSteps[next - 1].focusNode);
                }}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
              >
                Previous
              </button>
              <button
                className="btn btn-primary"
                disabled={judgeStep >= judgeSteps.length}
                onClick={() => {
                  const next = judgeStep + 1;
                  setJudgeStep(next);
                  setSelectedNode(judgeSteps[next - 1].focusNode);
                }}
                style={{ background: 'var(--accent-purple)', padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
              >
                Next Step
              </button>
            </div>
          </div>
        )}

        {/* 3D Scene Viewport (or 2D Fallback) */}
        {!is2DFallback ? (
          <ThreeArchitectureScene
            currentProvider={currentProvider}
            isTechnicalView={isTechnicalView}
            activePacketStep={activePacketStep}
            packetStatusText={packetStatusText}
            selectedNodeId={selectedNode.id}
            onSelectNode={(node) => setSelectedNode(node)}
            onResetCameraRef={(fn) => setResetCameraFn(() => fn)}
          />
        ) : (
          <Architecture2DFallback currentProvider={currentProvider} namespace={namespace} />
        )}
      </div>

      {/* Two-Column Inspection & Differences Section */}
      <div className="grid-2">
        {/* Panel 1: Under-The-Hood Node Inspector */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Info size={18} color="var(--accent-emerald)" />
              <span>Under-The-Hood: {selectedNode.name}</span>
            </div>
            <span className="badge" style={{ background: '#1e293b', color: 'var(--text-muted)' }}>
              {selectedNode.category.toUpperCase()}
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
            {selectedNode.description}
          </p>

          <div style={{
            background: 'var(--bg-input)',
            padding: '0.85rem',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Engineered Responsibilities:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {selectedNode.responsibilities.map((resp, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                  <CheckCircle size={13} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{resp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel 2: Adapter Technical Differences Comparison */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <ArrowRightLeft size={18} color="var(--accent-amber)" />
              <span>Backend Differences Standardized by Abstraction</span>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            The abstraction normalizes deep wire-level protocol differences across backends:
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.6rem',
            fontSize: '0.75rem',
          }}>
            {/* Redis Column */}
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '0.35rem' }}>
                REDIS ADAPTER
              </div>
              <ul style={{ paddingLeft: '1rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                <li><strong>Clear</strong>: Batch delete via <code>SCAN namespace:*</code> (no FLUSHDB)</li>
                <li><strong>TTL</strong>: Direct relative seconds</li>
                <li><strong>Errors</strong>: redis.ConnectionError mapped to CacheConnectionError</li>
              </ul>
            </div>

            {/* Memcached Column */}
            <div style={{ background: 'rgba(6, 182, 212, 0.08)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
              <div style={{ fontWeight: 700, color: '#22d3ee', marginBottom: '0.35rem' }}>
                MEMCACHED ADAPTER
              </div>
              <ul style={{ paddingLeft: '1rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                <li><strong>Clear</strong>: Instant O(1) epoch versioning (<code>_ns_ver:X</code>)</li>
                <li><strong>TTL</strong>: Translates &gt;30d durations to Unix timestamps</li>
                <li><strong>Errors</strong>: MemcachedSocketError mapped to CacheConnectionError</li>
              </ul>
            </div>
          </div>

          <div style={{
            marginTop: '0.75rem',
            padding: '0.5rem 0.75rem',
            background: 'var(--bg-input)',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: '#38bdf8',
          }}>
            <HelpCircle size={14} />
            <span>Application code never sees these differences — the contract is 100% portable.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
