import React, { useState } from 'react';
import { ShoppingBag, RefreshCw, Tag } from 'lucide-react';
import { cacheApi } from '../api/cacheApi';
import { OperationResult, ProductResponse } from '../types';

interface ECommerceDemoProps {
  currentProvider: string;
  onLogResult: (result: OperationResult) => void;
}

export const ECommerceDemo: React.FC<ECommerceDemoProps> = ({ currentProvider, onLogResult }) => {
  const [selectedProduct, setSelectedProduct] = useState<string>('prod_101');
  const [productData, setProductData] = useState<ProductResponse | null>(null);
  const [lastQueryTime, setLastQueryTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [newPrice, setNewPrice] = useState<string>('299.99');
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const sampleProducts = [
    { id: 'prod_101', name: 'Ultra HD 4K Monitor 27-inch', defaultPrice: 349.99 },
    { id: 'prod_102', name: 'Wireless Ergonomic Mechanical Keyboard', defaultPrice: 129.50 },
    { id: 'prod_103', name: 'Noise-Cancelling Studio Headphones', defaultPrice: 199.00 },
  ];

  const handleFetchProduct = async (productId: string) => {
    setIsLoading(true);
    setUpdateMsg(null);
    setSelectedProduct(productId);

    const res = await cacheApi.getProduct(productId);
    onLogResult(res);

    if (res.success && res.data) {
      setProductData(res.data);
      setLastQueryTime(res.latencyMs);
    }
    setIsLoading(false);
  };

  const handleUpdatePrice = async () => {
    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    setIsLoading(true);
    const res = await cacheApi.updateProductPrice(selectedProduct, priceNum);
    onLogResult(res);

    if (res.success) {
      setUpdateMsg(`✓ Price updated to $${priceNum.toFixed(2)} and cache key invalidated! Next read will re-fetch from database.`);
      // Refresh to see cache miss/refetch
      await handleFetchProduct(selectedProduct);
    }
    setIsLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShoppingBag size={18} color="var(--accent-blue)" />
            <span>Real-World Use Case: E-Commerce Product Catalog</span>
          </div>
          <span className={`badge badge-${currentProvider.toLowerCase()}`}>
            Active Provider: {currentProvider.toUpperCase()}
          </span>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Demonstrates the <strong>Cache-Aside Pattern</strong>. First read fetches from database (controlled 100ms latency); subsequent reads return from cache in &lt;1ms. Price updates trigger cache invalidation.
        </p>

        <div className="grid-2">
          {/* Left Column: Product Selector & Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">
                <span>SELECT CATALOG PRODUCT</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sampleProducts.map((p) => {
                  const isSelected = selectedProduct === p.id;
                  return (
                    <button
                      key={p.id}
                      className="btn"
                      onClick={() => handleFetchProduct(p.id)}
                      disabled={isLoading}
                      style={{
                        justifyContent: 'space-between',
                        background: isSelected ? 'var(--bg-card-alt)' : 'var(--bg-input)',
                        border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                        color: 'var(--text-main)',
                        padding: '0.75rem 1rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Tag size={14} color={isSelected ? '#60a5fa' : 'var(--text-dim)'} />
                        <span style={{ fontWeight: isSelected ? 600 : 400 }}>{p.name}</span>
                      </div>
                      <span className="font-mono" style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                        {p.id}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price Update & Invalidation */}
            <div style={{
              background: 'var(--bg-input)',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <label className="input-label" style={{ marginBottom: '0.5rem' }}>
                <span>UPDATE PRICE & INVALIDATE CACHE</span>
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.01"
                  className="input-control"
                  placeholder="New price"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleUpdatePrice}
                  disabled={isLoading || !newPrice}
                  style={{ background: '#0284c7' }}
                >
                  <Tag size={14} /> Update Price
                </button>
              </div>
              {updateMsg && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#34d399' }}>
                  {updateMsg}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Query Outcome */}
          <div style={{
            background: 'var(--bg-input)',
            padding: '1.25rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Query Result & Latency</h3>
                {productData && (
                  <span className={`badge ${productData.source === 'cache' ? 'badge-hit' : 'badge-miss'}`}>
                    {productData.source === 'cache' ? '⚡ SERVED FROM CACHE' : '🐢 SERVED FROM DATABASE'}
                  </span>
                )}
              </div>

              {productData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {productData.name}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>
                      ${productData.price.toFixed(2)}
                    </div>
                    <span className="badge" style={{ background: '#1e293b', color: 'var(--text-muted)' }}>
                      {productData.category}
                    </span>
                  </div>

                  {/* Latency Comparison Card */}
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'var(--bg-card)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Measured Latency:</span>
                      <span className="font-mono" style={{ fontWeight: 700, color: productData.source === 'cache' ? '#34d399' : '#fbbf24' }}>
                        {lastQueryTime !== null ? `${lastQueryTime.toFixed(2)} ms` : 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Data Origin:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {productData.source === 'cache' ? `Cache (${currentProvider.toUpperCase()})` : 'Simulated DB (100ms)'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  Select a product to observe cold vs. warm cache query latency.
                </div>
              )}
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => handleFetchProduct(selectedProduct)}
              disabled={isLoading}
              style={{ width: '100%', marginTop: '1rem' }}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Re-Query Product
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
