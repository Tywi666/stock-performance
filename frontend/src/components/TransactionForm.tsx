import React, { useState } from 'react';
import { TransactionType } from '../types';
import { api } from '../services/api';
import { toast } from './Toast';

interface Props {
    ticker: string;
    onRefresh: () => void;
}

const TransactionForm: React.FC<Props> = ({ ticker, onRefresh }) => {
    const [tab, setTab] = useState<'buy' | 'div'>('buy');
    const [loading, setLoading] = useState(false);

    // Buy form
    const [buyDate, setBuyDate] = useState(() => new Date().toISOString().slice(0, 10).replace(/-/g, '/'));
    const [shares, setShares] = useState('');
    const [cost, setCost] = useState('');

    // Dividend form
    const [divDate, setDivDate] = useState(() => new Date().toISOString().slice(0, 10).replace(/-/g, '/'));
    const [divAmount, setDivAmount] = useState('');

    const handleBuy = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shares || !cost) return;
        setLoading(true);
        try {
            await api.addTransaction({
                type: TransactionType.PURCHASE,
                date: buyDate,
                ticker,
                shares: parseInt(shares),
                total_amount: parseFloat(cost),
            });
            toast(`✅ 已記錄買入 ${ticker}`);
            setShares(''); setCost('');
            onRefresh();
        } catch (err) {
            toast(`❌ ${(err as Error).message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDiv = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!divAmount) return;
        setLoading(true);
        try {
            await api.addTransaction({
                type: TransactionType.DIVIDEND,
                date: divDate,
                ticker,
                dividend: parseFloat(divAmount),
            });
            toast(`✅ 已記錄股利 ${ticker}`);
            setDivAmount('');
            onRefresh();
        } catch (err) {
            toast(`❌ ${(err as Error).message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <div className="form-tabs">
                <button className={`form-tab ${tab === 'buy' ? 'active' : ''}`} onClick={() => setTab('buy')}>📥 買入</button>
                <button className={`form-tab ${tab === 'div' ? 'active' : ''}`} onClick={() => setTab('div')}>💰 股利</button>
            </div>

            {tab === 'buy' ? (
                <form onSubmit={handleBuy}>
                    <div className="form-group">
                        <label>日期</label>
                        <input
                            type="text"
                            value={buyDate}
                            onChange={e => setBuyDate(e.target.value)}
                            placeholder="yyyy/mm/dd"
                        />
                    </div>
                    <div className="form-group">
                        <label>股數</label>
                        <input
                            type="number"
                            value={shares}
                            onChange={e => setShares(e.target.value)}
                            placeholder="例: 1000"
                            min="1"
                        />
                    </div>
                    <div className="form-group">
                        <label>花費成本 (總金額)</label>
                        <input
                            type="number"
                            value={cost}
                            onChange={e => setCost(e.target.value)}
                            placeholder="例: 60000"
                            min="0"
                        />
                    </div>
                    {shares && cost && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                            每股均價：${(parseFloat(cost) / parseInt(shares)).toFixed(2)}
                        </div>
                    )}
                    <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
                        {loading ? '記錄中…' : '新增買入記錄'}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleDiv}>
                    <div className="form-group">
                        <label>日期</label>
                        <input
                            type="text"
                            value={divDate}
                            onChange={e => setDivDate(e.target.value)}
                            placeholder="yyyy/mm/dd"
                        />
                    </div>
                    <div className="form-group">
                        <label>股利金額</label>
                        <input
                            type="number"
                            value={divAmount}
                            onChange={e => setDivAmount(e.target.value)}
                            placeholder="例: 2000"
                            min="0"
                        />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
                        {loading ? '記錄中…' : '新增股利記錄'}
                    </button>
                </form>
            )}
        </div>
    );
};

export default TransactionForm;
