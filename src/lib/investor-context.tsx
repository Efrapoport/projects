"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { Investor } from "./types";
import { INVESTOR_CATALOG, DEFAULT_TRACKED_IDS } from "./investor-data";

const STORAGE_KEY = "tracked-investors";

interface InvestorContextValue {
  /** All investors available in the catalog */
  catalog: Investor[];
  /** The user's currently tracked investors */
  trackedInvestors: Investor[];
  /** Set of tracked investor IDs (for fast lookup) */
  trackedIds: Set<string>;
  /** Add an investor to the tracked list */
  addInvestor: (id: string) => void;
  /** Remove an investor from the tracked list */
  removeInvestor: (id: string) => void;
  /** Replace tracked list with a new set of IDs */
  setTrackedIds: (ids: string[]) => void;
  /** Check if an investor is tracked */
  isTracked: (id: string) => boolean;
}

const InvestorContext = createContext<InvestorContextValue | null>(null);

function loadTrackedIds(): string[] {
  if (typeof window === "undefined") return DEFAULT_TRACKED_IDS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Corrupted storage — fall back to defaults
  }
  return DEFAULT_TRACKED_IDS;
}

export function InvestorProvider({ children }: { children: ReactNode }) {
  const [trackedIdList, setTrackedIdList] = useState<string[]>(DEFAULT_TRACKED_IDS);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setTrackedIdList(loadTrackedIds());
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trackedIdList));
    } catch {
      // Storage full or disabled — silently ignore
    }
  }, [trackedIdList]);

  const trackedIds = new Set(trackedIdList);

  const trackedInvestors = INVESTOR_CATALOG.filter((inv) =>
    trackedIds.has(inv.id),
  );

  const addInvestor = useCallback((id: string) => {
    setTrackedIdList((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeInvestor = useCallback((id: string) => {
    setTrackedIdList((prev) => prev.filter((x) => x !== id));
  }, []);

  const setTrackedIds = useCallback((ids: string[]) => {
    setTrackedIdList(ids);
  }, []);

  const isTracked = useCallback(
    (id: string) => trackedIds.has(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trackedIdList],
  );

  return (
    <InvestorContext.Provider
      value={{
        catalog: INVESTOR_CATALOG,
        trackedInvestors,
        trackedIds,
        addInvestor,
        removeInvestor,
        setTrackedIds,
        isTracked,
      }}
    >
      {children}
    </InvestorContext.Provider>
  );
}

export function useInvestors(): InvestorContextValue {
  const ctx = useContext(InvestorContext);
  if (!ctx) {
    throw new Error("useInvestors must be used within an InvestorProvider");
  }
  return ctx;
}
