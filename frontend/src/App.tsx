import React, { useState, useEffect, useCallback } from 'react';
import { Portfolio, StockData } from './types';
import { api } from './services/api';
import { toast, ToastProvider } from './components/Toast';
import StockManager from './components/StockManager';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import TransactionTable from './components/TransactionTable';

const App: React.FC = () => {
    const [portfolio, setPortfolio] = useState<Portfolio>({});
    const [activeTicker, setActiveTicker] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [priceLoading, setPriceLoading] = useState(false);

    // ── Load data from API ───────────────────────────────────────
    const loadPortfolio = useCallback(async () => {
        try {
            const data = await api.getPortfolio();
            setPortfolio(data);
            // Keep active ticker valid
            setActiveTicker(prev => {
                if (prev && data[prev]) return prev;
                return Object.keys(data)[0] ?? null;
            });
        } catch (err) {
            toast(`載入失敗: ${(err as Error).message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

    const activeStock: StockData | null = activeTicker ? (portfolio[activeTicker] ?? null) : null;

    // ── Handlers ─────────────────────────────────────────────────
    const handleAddStock = (ticker: string) => {
        if (portfolio[ticker]) { toast(`${ticker} 已存在`, 'error'); return; }
        // Optimistically add locally (no API needed — stock tab is display-only)
        setPortfolio(prev => ({
            ...prev,
            [ticker]: { ticker, currentPrice: 0, transactions: [] },
        }));
        setActiveTicker(ticker);
        toast(`✅ 已新增 ${ticker}`);
    };

    const handleDeleteStock = (ticker: string) => {
        if (!window.confirm(`確定要刪除 ${ticker} 的所有資料嗎？`)) return;
        // Note: we only remove from local view; transactions stay in Sheet
        // To fully delete, user must delete individual transactions
        setPortfolio(prev => {
            const next = { ...prev };
            delete next[ticker];
            return next;
        });
        if (activeTicker === ticker) {
            const remaining = Object.keys(portfolio).filter(t => t !== ticker);
            setActiveTicker(remaining[0] ?? null);
        }
        toast(`🗑️ 已移除 ${ticker}`);
    };

    const handlePriceChange = (price: number) => {
        if (!activeTicker) return;
        setPortfolio(prev => ({
            ...prev,
            [activeTicker]: { ...prev[activeTicker], currentPrice: price },
        }));
    };

    const handleRefreshPrice = async () => {
        if (!activeTicker) return;
        setPriceLoading(true);
        try {
            // Try FinMind or Yahoo as a simple placeholder — just reload portfolio
            await loadPortfolio();
        } finally {
            setPriceLoading(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="loading-overlay" style={{ minHeight: '100vh' }}>
                <div className="spinner" />
                載入資料中…
            </div>
        );
    }

    return (
        <ToastProvider>
            <div className="app-wrapper">
                {/* Header */}
                <header className="app-header">
                    <div>
                        <h1>存股統計</h1>
                        <div className="subtitle">Stock Performance Tracker</div>
                    </div>
                    <button className="btn-secondary" onClick={loadPortfolio}>↻ 重新整理</button>
                </header>

                {/* Stock Tabs */}
                <StockManager
                    portfolio={portfolio}
                    activeTicker={activeTicker}
                    onSelect={setActiveTicker}
                    onAdd={handleAddStock}
                    onDelete={handleDeleteStock}
                />

                {activeStock ? (
                    <div className="main-grid" style={{ marginTop: '1.25rem' }}>
                        {/* Sidebar */}
                        <div className="sidebar-stack">
                            <TransactionForm ticker={activeTicker!} onRefresh={loadPortfolio} />
                        </div>

                        {/* Main content */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <Dashboard
                                stockData={activeStock}
                                onPriceChange={handlePriceChange}
                                isPriceLoading={priceLoading}
                                onRefreshPrice={handleRefreshPrice}
                            />
                            <TransactionTable
                                transactions={activeStock.transactions}
                                onRefresh={loadPortfolio}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="empty-state" style={{ marginTop: '3rem' }}>
                        <h2>歡迎使用存股統計！</h2>
                        <p style={{ marginTop: '0.5rem' }}>新增一個股票代號開始記錄</p>
                    </div>
                )}
            </div>
        </ToastProvider>
    );
};

export default App;
