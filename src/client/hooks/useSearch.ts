import { useState, useEffect, useRef } from 'react';
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
  const [loading, setLoading] = useState(false);
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

  // Fetch search results when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    searchImages(debouncedQuery, 1, limit)
      .then((response) => {
        if (!cancelled) {
          setResults(response.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, limit]);

  return {
    query,
    setQuery,
    results,
    loading,
    isActive: debouncedQuery.length > 0,
  };
}
