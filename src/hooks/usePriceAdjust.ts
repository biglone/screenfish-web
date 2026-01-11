import { useCallback, useEffect, useState } from 'react';

export type PriceAdjustMode = 'none' | 'qfq' | 'hfq';

const STORAGE_KEY = 'screenfish_price_adjust';
const CHANGE_EVENT = 'screenfish_price_adjust_changed';
const DEFAULT_MODE: PriceAdjustMode = 'qfq';

function normalizeMode(value: unknown): PriceAdjustMode {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'none' || v === 'qfq' || v === 'hfq') return v;
  return DEFAULT_MODE;
}

export function getStoredPriceAdjust(): PriceAdjustMode {
  try {
    return normalizeMode(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_MODE;
  }
}

export function setStoredPriceAdjust(mode: PriceAdjustMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  } catch {
    // ignore
  }
}

export function usePriceAdjust() {
  const [mode, setMode] = useState<PriceAdjustMode>(() => getStoredPriceAdjust());

  const setAndStore = useCallback((next: PriceAdjustMode) => {
    const normalized = normalizeMode(next);
    setMode(normalized);
    setStoredPriceAdjust(normalized);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setMode(getStoredPriceAdjust());
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  return [mode, setAndStore] as const;
}

