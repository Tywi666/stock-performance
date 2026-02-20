import React, { useState } from 'react';
import { Portfolio } from '../types';

interface Props {
    portfolio: Portfolio;
    activeTicker: string | null;
    onSelect: (ticker: string) => void;
    onAdd: (ticker: string) => void;
    onDelete: (ticker: string) => void;
}

const StockManager: React.FC<Props> = ({ portfolio, activeTicker, onSelect, onAdd, onDelete }) => {
    const [input, setInput] = useState('');

    const handleAdd = () => {
        const t = input.trim().toUpperCase();
        if (!t) return;
        onAdd(t);
        setInput('');
    };

    return (
        <div className="card">
            <div className="card-title">我的股票 My Portfolio</div>
            <div className="stock-tabs">
                {Object.keys(portfolio).map(ticker => (
                    <div
                        key={ticker}
                        className={`stock-tab ${activeTicker === ticker ? 'active' : ''}`}
                        onClick={() => onSelect(ticker)}
                    >
                        {ticker}
                        <span
                            className="delete-x"
                            onClick={e => { e.stopPropagation(); onDelete(ticker); }}
                            title={`刪除 ${ticker}`}
                        >✕</span>
                    </div>
                ))}
            </div>
            <div className="add-stock-row">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="輸入股票代號，例如 2330"
                    maxLength={10}
                />
                <button className="btn-primary" onClick={handleAdd}>+ 新增</button>
            </div>
        </div>
    );
};

export default StockManager;
