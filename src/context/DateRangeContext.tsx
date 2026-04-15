import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type DateRangeState = { start: string; end: string };

export function toYYYYMMDD(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function defaultRange(): DateRangeState {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { start: toYYYYMMDD(start), end: toYYYYMMDD(today) };
}

type Ctx = {
  dateRange: DateRangeState;
  setDateRange: (r: DateRangeState) => void;
};

const DateRangeContext = createContext<Ctx | null>(null);

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [dateRange, setDateRangeState] = useState<DateRangeState>(defaultRange);
  const setDateRange = useCallback((r: DateRangeState) => {
    setDateRangeState(r);
  }, []);

  const value = useMemo(() => ({ dateRange, setDateRange }), [dateRange, setDateRange]);

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) {
    throw new Error('useDateRange must be used within DateRangeProvider');
  }
  return ctx;
}
