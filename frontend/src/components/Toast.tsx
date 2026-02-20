import React, { useState } from 'react';

interface Toast { id: number; msg: string; type: 'success' | 'error'; }

let _addToast: ((msg: string, type?: 'success' | 'error') => void) | null = null;

export function toast(msg: string, type: 'success' | 'error' = 'success') {
    _addToast?.(msg, type);
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    _addToast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(p => [...p, { id, msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    return (
        <>
            {children}
            <div className="toast-container">
                {toasts.map(t => (
                    <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
                ))}
            </div>
        </>
    );
};
