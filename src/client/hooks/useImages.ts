import { useState, useEffect, useCallback } from 'react';
import type { ImageRow } from '@/shared/types';
import { fetchImages } from '../lib/api';

interface UseImagesReturn {
  images: ImageRow[];
  total: number;
  loading: boolean;
  error: string | null;
  page: number;
  setPage: (page: number) => void;
  refresh: () => void;
}

export function useImages(limit = 50): UseImagesReturn {
  const [images, setImages] = useState<ImageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchImages(page, limit)
      .then((result) => {
        if (!cancelled) {
          setImages(result.data);
          setTotal(result.total);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
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
  }, [page, limit, refreshKey]);

  return { images, total, loading, error, page, setPage, refresh };
}
