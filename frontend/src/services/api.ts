import { Portfolio, TransactionType } from '../types';

const BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? `Request failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
}

export const api = {
    getPortfolio: () =>
        request<{ portfolio: Portfolio }>('/api/portfolio').then(r => r.portfolio),

    addTransaction: (payload: {
        type: TransactionType;
        date: string;
        ticker: string;
        shares?: number;
        price?: number;
        total_amount?: number;
        dividend?: number;
        note?: string;
    }) =>
        request<{ success: boolean; id: string; ticker: string }>('/api/transactions', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    deleteTransaction: (id: string) =>
        request<{ success: boolean }>(`/api/transactions/${id}`, { method: 'DELETE' }),

    getPrice: (ticker: string) =>
        request<{ ticker: string; price: number }>(`/api/price/${ticker}`),
};

