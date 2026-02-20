import { useMemo } from 'react';
import { Transaction, TransactionType } from '../types';

export function useStockCalculator(transactions: Transaction[], currentPrice: number) {
    return useMemo(() => {
        const purchases = transactions.filter(t => t.type === TransactionType.PURCHASE);
        const dividends = transactions.filter(t => t.type === TransactionType.DIVIDEND);

        const totalShares = purchases.reduce((s, t) => s + (t.shares || 0), 0);
        const totalCost = purchases.reduce((s, t) => s + (t.total_amount || 0), 0);
        const totalDivs = dividends.reduce((s, t) => s + (t.dividend || 0), 0);

        const bookCost = totalShares > 0 ? totalCost / totalShares : 0;
        const actualCost = totalShares > 0 ? (totalCost - totalDivs) / totalShares : 0;
        const marketValue = currentPrice * totalShares;
        const totalPL = (marketValue + totalDivs) - totalCost;
        const returnRate = totalCost > 0 ? totalPL / totalCost : 0;

        return { totalShares, totalCost, totalDivs, bookCost, actualCost, totalPL, returnRate, marketValue };
    }, [transactions, currentPrice]);
}
