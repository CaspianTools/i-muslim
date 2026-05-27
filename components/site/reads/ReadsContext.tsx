"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LOCAL_READS_EVENT, getLocalReadIds } from "@/lib/reads/local";

interface ReadsContextValue {
  has: (readId: string) => boolean;
  setLocal: (readId: string, marked: boolean) => void;
}

const ReadsContext = createContext<ReadsContextValue | null>(null);

interface ReadsProviderProps {
  /**
   * Initial set of read IDs, fetched server-side for the current page slice
   * (e.g. all hadith reads for a given collection page).
   */
  initialReadIds?: string[];
  /**
   * When true, source state from localStorage and stay subscribed to changes.
   * Used for anonymous (signed-out) visitors where Firestore is unavailable.
   */
  subscribeToLocalStorage?: boolean;
  children: ReactNode;
}

export function ReadsProvider({
  initialReadIds = [],
  subscribeToLocalStorage = false,
  children,
}: ReadsProviderProps) {
  const [reads, setReads] = useState<Set<string>>(() => new Set(initialReadIds));

  useEffect(() => {
    if (!subscribeToLocalStorage) return;
    const sync = () => setReads(getLocalReadIds());
    sync();
    window.addEventListener(LOCAL_READS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LOCAL_READS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [subscribeToLocalStorage]);

  const setLocal = useCallback((readId: string, marked: boolean) => {
    setReads((prev) => {
      const next = new Set(prev);
      if (marked) next.add(readId);
      else next.delete(readId);
      return next;
    });
  }, []);

  const value = useMemo<ReadsContextValue>(
    () => ({ has: (id) => reads.has(id), setLocal }),
    [reads, setLocal],
  );

  return <ReadsContext.Provider value={value}>{children}</ReadsContext.Provider>;
}

export function useReadsContext(): ReadsContextValue | null {
  return useContext(ReadsContext);
}
