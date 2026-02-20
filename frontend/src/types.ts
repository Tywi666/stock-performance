export enum TransactionType {
    PURCHASE = 'PURCHASE',
    DIVIDEND = 'DIVIDEND',
}

export interface Transaction {
    id: string;
    type: TransactionType;
    date: string;
    shares: number;
    price: number;
    total_amount: number;
    dividend: number;
    note: string;
}

export interface StockData {
    ticker: string;
    currentPrice: number;
    transactions: Transaction[];
}

export interface Portfolio {
    [ticker: string]: StockData;
}
