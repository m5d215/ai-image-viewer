import { useState, useEffect, useRef, useMemo } from 'react';
import type { ImageRow } from '@/shared/types';
import { searchImages } from '../lib/api';

interface UseSearchOptions {
  initialQuery?: string | undefined;
  limit?: number | undefined;
  includeTagIds?: number[] | undefined;
  excludeTagIds?: number[] | undefined;
  tagMode?: 'and' | 'or' | undefined;
}

interface UseSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: ImageRow[];
  loading: boolean;
  isActive: boolean;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { initialQuery = '', limit = 50, includeTagIds, excludeTagIds, tagMode } = options;
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [results, setResults] = useState<ImageRow[]>([]);
  // Track which query the current results correspond to. When this differs
  // from debouncedQuery, a fetch is in-flight → loading.
  const [settledQuery, setSettledQuery] = useState(initialQuery);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonically increasing request ID — StrictMode safe because only the
  // latest request's callback will match, regardless of how many times the
  // effect fires.
  const requestIdRef = useRef(0);

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

  // Stable keys for tag filter arrays to use in effect deps
  const includeKey = includeTagIds?.join(',') ?? '';
  const excludeKey = excludeTagIds?.join(',') ?? '';

  // Fetch search results when debounced query or tag filters change
  useEffect(() => {
    if (!isActive) {
      // Invalidate any pending request so its response won't flash stale
      // results during the debounce window when clearing the search.
      ++requestIdRef.current;
      return;
    }

    const id = ++requestIdRef.current;

    searchImages(debouncedQuery, 1, limit, includeTagIds, excludeTagIds, tagMode)
      .then((response) => {
        if (id === requestIdRef.current) {
          setResults(response.data);
          setSettledQuery(debouncedQuery);
        }
      })
      .catch(() => {
        if (id === requestIdRef.current) {
          setResults([]);
          setSettledQuery(debouncedQuery);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- use stable string keys instead of array refs
  }, [debouncedQuery, limit, isActive, includeKey, excludeKey, tagMode]);

  // Derive display state — avoids synchronous setState in effects for the
  // inactive case and prevents stale results from flashing.
  const displayResults = useMemo(() => (isActive ? results : []), [isActive, results]);
  const loading = isActive && settledQuery !== debouncedQuery;

  return {
    query,
    setQuery,
    results: displayResults,
    loading,
    isActive,
  };
}
