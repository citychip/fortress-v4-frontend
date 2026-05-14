/**
 * FORTRESS V2 — PendingOrdersContext
 * Stores user-confirmed trade setups locally (localStorage) before execution.
 * Orders are added from the Candidates page and reviewed in the Orders tab.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface PendingOrder {
  id: string;           // uuid-like timestamp key
  ticker: string;
  strategy: string;     // e.g. "Bull Put Spread"
  shortStrike: number;
  longStrike: number;
  expiry: string;       // human-readable e.g. "Jun 20, 2026"
  creditMin: number;
  creditMax: number;
  qty: number;
  rationale: string;
  dpFloorUsed?: number; // DP floor that anchored the short strike (if any)
  addedAt: string;      // ISO timestamp
}

interface PendingOrdersCtx {
  orders: PendingOrder[];
  addOrder: (order: Omit<PendingOrder, 'id' | 'addedAt'>) => void;
  removeOrder: (id: string) => void;
  clearAll: () => void;
  hasOrder: (ticker: string) => boolean;
}

const STORAGE_KEY = 'fortress-v2-pending-orders';

function loadFromStorage(): PendingOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingOrder[];
  } catch {
    return [];
  }
}

function saveToStorage(orders: PendingOrder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // ignore storage errors
  }
}

const PendingOrdersContext = createContext<PendingOrdersCtx>({
  orders: [],
  addOrder: () => {},
  removeOrder: () => {},
  clearAll: () => {},
  hasOrder: () => false,
});

export function PendingOrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<PendingOrder[]>(() => loadFromStorage());

  const addOrder = useCallback((order: Omit<PendingOrder, 'id' | 'addedAt'>) => {
    const newOrder: PendingOrder = {
      ...order,
      id: `${order.ticker}-${Date.now()}`,
      addedAt: new Date().toISOString(),
    };
    setOrders(prev => {
      const updated = [newOrder, ...prev];
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const removeOrder = useCallback((id: string) => {
    setOrders(prev => {
      const updated = prev.filter(o => o.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setOrders([]);
    saveToStorage([]);
  }, []);

  const hasOrder = useCallback((ticker: string) => {
    return orders.some(o => o.ticker === ticker);
  }, [orders]);

  return (
    <PendingOrdersContext.Provider value={{ orders, addOrder, removeOrder, clearAll, hasOrder }}>
      {children}
    </PendingOrdersContext.Provider>
  );
}

export function usePendingOrders() {
  return useContext(PendingOrdersContext);
}
