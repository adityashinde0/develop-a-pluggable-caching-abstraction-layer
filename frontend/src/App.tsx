import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ProviderSwitcher } from './components/ProviderSwitcher';
import { ArchitectureVisualizer } from './components/ArchitectureVisualizer';
import { HealthInfoCard } from './components/HealthInfoCard';
import { CacheOperationsPanel } from './components/CacheOperationsPanel';
import { ResultPanel } from './components/ResultPanel';
import { SemanticDemos } from './components/SemanticDemos';
import { GuidedDemoRunner } from './components/GuidedDemoRunner';
import { ActivityLog } from './components/ActivityLog';
import { ECommerceDemo } from './components/ECommerceDemo';
import { ArchitectureInvariants } from './components/ArchitectureInvariants';
import { cacheApi } from './api/cacheApi';
import {
  ActivityLogItem,
  BackendType,
  CacheInfoResponse,
  HealthResponse,
  MetricsSnapshot,
  OperationResult,
} from './types';

export const App: React.FC = () => {
  // State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [info, setInfo] = useState<CacheInfoResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [lastResult, setLastResult] = useState<OperationResult | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<'console' | 'semantics' | 'ecommerce' | 'architecture' | 'tour'>('console');

  // Loading States
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [isLoadingOp, setIsLoadingOp] = useState<boolean>(false);
  const [isResettingMetrics, setIsResettingMetrics] = useState<boolean>(false);
  const [lastSwitchMessage, setLastSwitchMessage] = useState<string | null>(null);
  const [lastSwitchSuccess, setLastSwitchSuccess] = useState<boolean | null>(null);

  // Helper to add activity log item
  const logActivity = useCallback((item: Omit<ActivityLogItem, 'id' | 'timestamp'>) => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    const newLog: ActivityLogItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: timeStr,
    };
    setActivityLogs((prev) => [newLog, ...prev.slice(0, 49)]); // keep latest 50
  }, []);

  // Fetch telemetry
  const refreshSystemState = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [healthRes, infoRes, metricsRes] = await Promise.all([
        cacheApi.getHealth(),
        cacheApi.getInfo(),
        cacheApi.getMetrics(),
      ]);

      if (healthRes.data) setHealth(healthRes.data);
      if (infoRes.data) setInfo(infoRes.data);
      if (metricsRes.data) setMetrics(metricsRes.data);
    } catch {
      // Gracefully handle offline states
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Polling on mount (every 5 seconds)
  useEffect(() => {
    refreshSystemState();
    const interval = setInterval(refreshSystemState, 5000);
    return () => clearInterval(interval);
  }, [refreshSystemState]);

  // Handler: Switch Provider
  const handleSwitch = async (targetBackend: BackendType) => {
    setIsSwitching(true);
    setLastSwitchMessage(null);
    setLastSwitchSuccess(null);

    const res = await cacheApi.switchBackend(targetBackend);
    setLastResult(res);

    if (res.success) {
      setLastSwitchSuccess(true);
      setLastSwitchMessage(`✓ Successfully switched active backend provider to ${targetBackend.toUpperCase()}`);
      logActivity({
        operation: 'SWITCH',
        provider: targetBackend,
        status: 'success',
        latencyMs: res.latencyMs,
        details: `Switched backend to ${targetBackend}`,
      });
      await refreshSystemState();
    } else {
      setLastSwitchSuccess(false);
      setLastSwitchMessage(`✕ Switch to ${targetBackend.toUpperCase()} failed: ${res.error || 'Health check rejected target'}`);
      logActivity({
        operation: 'SWITCH',
        provider: info?.provider || 'unknown',
        status: 'error',
        latencyMs: res.latencyMs,
        details: res.error,
      });
    }

    setIsSwitching(false);
  };

  // Handler: GET Key
  const handleGet = async (key: string) => {
    setIsLoadingOp(true);
    const res = await cacheApi.get(key);
    setLastResult(res);
    setIsLoadingOp(false);

    logActivity({
      operation: 'GET',
      key,
      provider: res.provider || info?.provider || 'unknown',
      status: res.isHit ? 'success' : res.isMiss ? 'miss' : 'error',
      latencyMs: res.latencyMs,
      isHit: res.isHit,
      isCachedNone: res.isCachedNone,
      isMiss: res.isMiss,
    });

    refreshSystemState();
  };

  // Handler: SET Key
  const handleSet = async (key: string, value: any, ttl?: number | null) => {
    setIsLoadingOp(true);
    const res = await cacheApi.set(key, value, ttl);
    setLastResult(res);
    setIsLoadingOp(false);

    logActivity({
      operation: 'SET',
      key,
      provider: res.provider || info?.provider || 'unknown',
      status: res.success ? 'success' : 'error',
      latencyMs: res.latencyMs,
      details: ttl ? `TTL: ${ttl}s` : 'No expiry',
    });

    refreshSystemState();
  };

  // Handler: DELETE Key
  const handleDelete = async (key: string) => {
    setIsLoadingOp(true);
    const res = await cacheApi.delete(key);
    setLastResult(res);
    setIsLoadingOp(false);

    logActivity({
      operation: 'DELETE',
      key,
      provider: res.provider || info?.provider || 'unknown',
      status: res.success ? 'success' : 'error',
      latencyMs: res.latencyMs,
    });

    refreshSystemState();
  };

  // Handler: CLEAR Namespace
  const handleClear = async () => {
    setIsLoadingOp(true);
    const res = await cacheApi.clear();
    setLastResult(res);
    setIsLoadingOp(false);

    logActivity({
      operation: 'CLEAR',
      provider: res.provider || info?.provider || 'unknown',
      status: res.success ? 'success' : 'error',
      latencyMs: res.latencyMs,
      details: `Cleared namespace: ${info?.namespace || 'default'}`,
    });

    refreshSystemState();
  };

  // Handler: Reset Metrics
  const handleResetMetrics = async () => {
    setIsResettingMetrics(true);
    const res = await cacheApi.resetMetrics();
    setIsResettingMetrics(false);
    if (res.success) {
      logActivity({
        operation: 'METRICS',
        provider: info?.provider || 'unknown',
        status: 'success',
        latencyMs: res.latencyMs,
        details: 'Metrics telemetry buffer reset',
      });
      await refreshSystemState();
    }
  };

  // Callback for Semantic & Guided Demos
  const handleLogExternalResult = (res: OperationResult) => {
    setLastResult(res);
    logActivity({
      operation: res.operation as any,
      key: res.key,
      provider: res.provider || info?.provider || 'unknown',
      status: res.isHit ? 'success' : res.isMiss ? 'miss' : res.success ? 'success' : 'error',
      latencyMs: res.latencyMs,
      isHit: res.isHit,
      isCachedNone: res.isCachedNone,
      isMiss: res.isMiss,
      details: res.error,
    });
    refreshSystemState();
  };

  const currentProvider = info?.provider || health?.provider || 'redis';

  return (
    <div className="app-container">
      {/* Header */}
      <Header
        health={health}
        metrics={metrics}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={refreshSystemState}
        isRefreshing={isRefreshing}
      />

      {/* Main Tab 1: Core Console */}
      {activeTab === 'console' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Top Row: Provider Switcher & Architecture Flow */}
          <div className="grid-2">
            <ProviderSwitcher
              currentProvider={currentProvider}
              isSwitching={isSwitching}
              onSwitch={handleSwitch}
              lastSwitchMessage={lastSwitchMessage}
              lastSwitchSuccess={lastSwitchSuccess}
            />
            <ArchitectureVisualizer
              currentProvider={currentProvider}
              namespace={info?.namespace}
            />
          </div>

          {/* Health & Telemetry Metrics */}
          <HealthInfoCard
            health={health}
            metrics={metrics}
            onResetMetrics={handleResetMetrics}
            isResetting={isResettingMetrics}
          />

          {/* Operations Console & Result Inspector */}
          <div className="grid-2">
            <CacheOperationsPanel
              onGet={handleGet}
              onSet={handleSet}
              onDelete={handleDelete}
              onClear={handleClear}
              isLoading={isLoadingOp}
            />
            <ResultPanel
              result={lastResult}
              isLoading={isLoadingOp}
            />
          </div>

          {/* Activity Log */}
          <ActivityLog
            logs={activityLogs}
            onClearLogs={() => setActivityLogs([])}
          />
        </div>
      )}

      {/* Main Tab 2: Guided Tour */}
      {activeTab === 'tour' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <GuidedDemoRunner
            currentProvider={currentProvider}
            onSwitchProvider={handleSwitch}
            onLogResult={handleLogExternalResult}
          />
          <div className="grid-2">
            <ResultPanel result={lastResult} isLoading={false} />
            <ActivityLog logs={activityLogs} onClearLogs={() => setActivityLogs([])} />
          </div>
        </div>
      )}

      {/* Main Tab 3: Semantic Demos */}
      {activeTab === 'semantics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <SemanticDemos onLogResult={handleLogExternalResult} />
          <div className="grid-2">
            <ResultPanel result={lastResult} isLoading={false} />
            <ActivityLog logs={activityLogs} onClearLogs={() => setActivityLogs([])} />
          </div>
        </div>
      )}

      {/* Main Tab 4: E-Commerce Demo */}
      {activeTab === 'ecommerce' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <ECommerceDemo
            currentProvider={currentProvider}
            onLogResult={handleLogExternalResult}
          />
          <ActivityLog logs={activityLogs} onClearLogs={() => setActivityLogs([])} />
        </div>
      )}

      {/* Main Tab 5: Architecture & Invariants */}
      {activeTab === 'architecture' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <ArchitectureVisualizer
            currentProvider={currentProvider}
            namespace={info?.namespace}
          />
          <ArchitectureInvariants />
        </div>
      )}
    </div>
  );
};

export default App;
