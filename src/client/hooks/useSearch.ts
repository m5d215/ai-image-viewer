import { useState, useEffect, useRef, useMemo, useReducer } from 'react';
import type { ImageRow } from '@/shared/types';
import { searchImages } from '../lib/api';

interface UseSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: ImageRow[];
  loading: boolean;
  isActive: boolean;
}

export function useSearch(limit = 50): UseSearchReturn {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<ImageRow[]>([]);
  const [fetchCount, incrementFetchCount] = useReducer((c: number) => c + 1, 0);
  const [settledCount, setSettledCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the query
  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query]);

  const isActive = debouncedQuery.length > 0;

  // Fetch search results when debounced query changes
  useEffect(() => {
    if (!isActive) {
      return;
    }

    let cancelled = false;
    incrementFetchCount();

    searchImages(debouncedQuery, 1, limit)
      .then((response) => {
        if (!cancelled) {
          setResults(response.data);
          setSettledCount((c) => c + 1);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setSettledCount((c) => c + 1);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, limit, isActive]);

  const loading = isActive && fetchCount !== settledCount;
  const displayResults = useMemo(() => (isActive ? results : []), [isActive, results]);

  return {
    query,
    setQuery,
    results: displayResults,
    loading,
    isActive,
  };
}
