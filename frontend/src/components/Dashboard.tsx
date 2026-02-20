import React from 'react';
import { useStockCalculator } from '../hooks/useStockCalculator';
import { StockData } from '../types';

interface Props {
    stockData: StockData;
    onPriceChange: (price: number) => void;
    isPriceLoading: boolean;
    onRefreshPrice: () => void;
}

function StatCard({ label, value, cls, note }: { label: string; value: string; cls: string; note?: string }) {
    return (
        <div className="stat-card">
            <div className="label">{label}</div>
            <div className={`value ${cls}`}>{value}</div>
            {note && <div className="note">{note}</div>}
        </div>
    );
}

const Dashboard: React.FC<Props> = ({ stockData, onPriceChange, isPriceLoading, onRefreshPrice }) => {
    const { totalShares, totalCost, totalDivs, bookCost, actualCost, totalPL, returnRate } =
        useStockCalculator(stockData.transactions, stockData.currentPrice);

    const plClass = totalPL >= 0 ? 'text-green' : 'text-red';
    const rrClass = returnRate >= 0 ? 'text-green' : 'text-red';

    return (
        <div className="card">
            {/* Price row */}
            <div className="price-row">
                <div>
                    <div className="price-label">目前市價</div>
                    <input
                        type="number"
                        value={stockData.currentPrice || ''}
                        onChange={e => onPriceChange(parseFloat(e.target.value) || 0)}
                        placeholder="輸入市價"
                        disabled={isPriceLoading}
                    />
                </div>
                <button className="btn-icon" onClick={onRefreshPrice} disabled={isPriceLoading} title="重新整理">
                    <svg className={`${isPriceLoading ? 'btn-spin' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 4v6h-6M1 20v-6h6" />
                        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <StatCard label="帳面成本 / 股" value={`$${bookCost.toFixed(2)}`} cls="text-white" note="avg purchase price" />
                <StatCard label="實際成本 / 股" value={`$${actualCost.toFixed(2)}`} cls="text-amber" note="after dividends" />
                <StatCard label="總報酬" value={`$${totalPL.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} cls={plClass} />
                <StatCard label="報酬率" value={`${(returnRate * 100).toFixed(2)}%`} cls={rrClass} />
                <StatCard label="總股數" value={totalShares.toLocaleString()} cls="text-white" />
                <StatCard label="總成本" value={`$${totalCost.toLocaleString()}`} cls="text-white" />
                <StatCard label="累計股利" value={`$${totalDivs.toLocaleString()}`} cls="text-green" />
                <StatCard
                    label="市值"
                    value={`$${(stockData.currentPrice * totalShares).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    cls="text-blue"
                />
            </div>
        </div>
    );
};

export default Dashboard;
