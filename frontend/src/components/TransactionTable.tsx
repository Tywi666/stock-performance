import React, { useState } from 'react';
import { Transaction, TransactionType } from '../types';
import { api } from '../services/api';
import { toast } from './Toast';

interface Props {
    transactions: Transaction[];
    onRefresh: () => void;
}

const TransactionTable: React.FC<Props> = ({ transactions, onRefresh }) => {
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        if (!window.confirm('確定要刪除這筆交易嗎？')) return;
        setDeletingId(id);
        try {
            await api.deleteTransaction(id);
            toast('🗑️ 已刪除');
            onRefresh();
        } catch (err) {
            toast(`❌ ${(err as Error).message}`, 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const parseDate = (d: string) => new Date(d.replace(/\//g, '-'));
    const sorted = [...transactions].sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

    return (
        <div className="card">
            <h2 style={{ marginBottom: '1rem', color: 'var(--accent)' }}>交易紀錄</h2>
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>日期</th>
                            <th>類型</th>
                            <th className="right">股數</th>
                            <th className="right">每股均價</th>
                            <th className="right">總金額</th>
                            <th className="right">股利</th>
                            <th className="center">刪除</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                                    尚無紀錄，請新增一筆交易！
                                </td>
                            </tr>
                        ) : sorted.map((t, i) => (
                            <tr key={t.id}>
                                <td style={{ color: 'var(--muted)' }}>{sorted.length - i}</td>
                                <td>{t.date}</td>
                                <td>
                                    <span className={`badge ${t.type === TransactionType.PURCHASE ? 'badge-buy' : 'badge-div'}`}>
                                        {t.type === TransactionType.PURCHASE ? '買入' : '股利'}
                                    </span>
                                </td>
                                <td className="right">{t.type === TransactionType.PURCHASE ? t.shares.toLocaleString() : '—'}</td>
                                <td className="right">{t.type === TransactionType.PURCHASE ? `$${t.price.toFixed(2)}` : '—'}</td>
                                <td className="right">{t.type === TransactionType.PURCHASE ? `$${t.total_amount.toLocaleString()}` : '—'}</td>
                                <td className="right" style={{ color: 'var(--green)' }}>
                                    {t.type === TransactionType.DIVIDEND ? `$${t.dividend.toLocaleString()}` : '—'}
                                </td>
                                <td className="center">
                                    <button
                                        className="btn-danger"
                                        onClick={() => handleDelete(t.id)}
                                        disabled={deletingId === t.id}
                                        title="刪除"
                                    >
                                        {deletingId === t.id ? '…' : (
                                            <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TransactionTable;
