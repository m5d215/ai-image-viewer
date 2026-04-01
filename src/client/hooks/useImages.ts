import { useReducer, useEffect, useCallback } from 'react';
import type { ImageRow } from '@/shared/types';
import { fetchImages } from '../lib/api';

interface UseImagesOptions {
  limit?: number;
  includeTagIds?: number[];
  excludeTagIds?: number[];
  tagMode?: 'and' | 'or';
}

interface UseImagesReturn {
  images: ImageRow[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refresh: () => void;
  loadMore: () => void;
}

interface State {
  images: ImageRow[];
  total: number;
  page: number;
  /** Initial load (page 1) in progress */
  loading: boolean;
  /** Subsequent page load in progress */
  loadingMore: boolean;
  error: string | null;
  refreshKey: number;
}

type Action =
  | { type: 'reset' }
  | { type: 'refresh' }
  | { type: 'loadMore' }
  | { type: 'fetchStart'; page: number }
  | { type: 'fetchSuccess'; data: ImageRow[]; total: number; page: number }
  | { type: 'fetchError'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return {
        ...state,
        images: [],
        total: 0,
        page: 1,
        loading: true,
        loadingMore: false,
        error: null,
      };
    case 'refresh':
      return {
        ...state,
        images: [],
        total: 0,
        page: 1,
        loading: true,
        loadingMore: false,
        error: null,
        refreshKey: state.refreshKey + 1,
      };
    case 'loadMore':
      if (state.loadingMore || state.loading) return state;
      return { ...state, page: state.page + 1 };
    case 'fetchStart':
      if (action.page === 1) {
        return { ...state, loading: true, error: null };
      }
      return { ...state, loadingMore: true, error: null };
    case 'fetchSuccess':
      if (action.page === 1) {
        return {
          ...state,
          images: action.data,
          total: action.total,
          loading: false,
          loadingMore: false,
        };
      }
      return {
        ...state,
        images: [...state.images, ...action.data],
        total: action.total,
        loadingMore: false,
      };
    case 'fetchError':
      return { ...state, error: action.error, loading: false, loadingMore: false };
  }
}

const initialState: State = {
  images: [],
  total: 0,
  page: 1,
  loading: true,
  loadingMore: false,
  error: null,
  refreshKey: 0,
};

export function useImages(options: UseImagesOptions = {}): UseImagesReturn {
  const { limit = 50, includeTagIds, excludeTagIds, tagMode } = options;
  const [state, dispatch] = useReducer(reducer, initialState);

  const refresh = useCallback(() => {
    dispatch({ type: 'refresh' });
  }, []);

  const loadMore = useCallback(() => {
    dispatch({ type: 'loadMore' });
  }, []);

  // Serialize tagIds for stable dependency comparison
  const includeTagIdsKey = includeTagIds !== undefined ? includeTagIds.join(',') : '';
  const excludeTagIdsKey = excludeTagIds !== undefined ? excludeTagIds.join(',') : '';

  // Reset when filter params change
  useEffect(() => {
    dispatch({ type: 'reset' });
  }, [includeTagIdsKey, excludeTagIdsKey, tagMode]);

  useEffect(() => {
    let cancelled = false;
    const currentPage = state.page;

    dispatch({ type: 'fetchStart', page: currentPage });

    fetchImages(currentPage, limit, undefined, includeTagIds, excludeTagIds, tagMode)
      .then((result) => {
        if (!cancelled) {
          dispatch({
            type: 'fetchSuccess',
            data: result.data,
            total: result.total,
            page: currentPage,
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          dispatch({
            type: 'fetchError',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.page, limit, includeTagIdsKey, excludeTagIdsKey, tagMode, state.refreshKey]);

  const hasMore = state.total > state.images.length;

  return {
    images: state.images,
    total: state.total,
    loading: state.loading,
    loadingMore: state.loadingMore,
    hasMore,
    error: state.error,
    refresh,
    loadMore,
  };
}
