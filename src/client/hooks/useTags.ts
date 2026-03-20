import { useState, useEffect, useCallback, useReducer } from 'react';
import type { TagId } from '@/shared/types';
import type { TagWithCount } from '../lib/api';
import {
  fetchTags,
  createTag as apiCreateTag,
  deleteTag as apiDeleteTag,
} from '../lib/api';

type TagState = 'include' | 'exclude';

interface UseTagsReturn {
  tags: TagWithCount[];
  loading: boolean;
  tagFilterState: Map<number, TagState>;
  tagMode: 'and' | 'or';
  setTagMode: (mode: 'and' | 'or') => void;
  toggleTag: (tagId: TagId) => void;
  createTag: (name: string) => Promise<void>;
  deleteTag: (id: TagId) => Promise<void>;
  refresh: () => void;
}

export function useTags(options?: {
  initialTagFilterState?: Map<number, TagState>;
  initialTagMode?: 'and' | 'or';
}): UseTagsReturn {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilterState, setTagFilterState] = useState<Map<number, TagState>>(options?.initialTagFilterState ?? new Map());
  const [tagMode, setTagMode] = useState<'and' | 'or'>(options?.initialTagMode ?? 'or');
  const [refreshKey, incrementRefreshKey] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    let cancelled = false;

    fetchTags()
      .then((result) => {
        if (!cancelled) {
          setTags(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const toggleTag = useCallback((tagId: TagId) => {
    setTagFilterState((prev) => {
      const next = new Map(prev);
      const current = next.get(tagId);
      if (current === undefined) {
        next.set(tagId, 'include');
      } else if (current === 'include') {
        next.set(tagId, 'exclude');
      } else {
        next.delete(tagId);
      }
      return next;
    });
  }, []);

  const createTag = useCallback(
    async (name: string): Promise<void> => {
      await apiCreateTag(name);
      incrementRefreshKey();
    },
    [],
  );

  const deleteTag = useCallback(
    async (id: TagId): Promise<void> => {
      await apiDeleteTag(id);
      setTagFilterState((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      incrementRefreshKey();
    },
    [],
  );

  return { tags, loading, tagFilterState, tagMode, setTagMode, toggleTag, createTag, deleteTag, refresh: incrementRefreshKey };
}
