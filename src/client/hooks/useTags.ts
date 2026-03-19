import { useState, useEffect, useCallback, useReducer } from 'react';
import type { TagId } from '@/shared/types';
import type { TagWithCount } from '../lib/api';
import {
  fetchTags,
  createTag as apiCreateTag,
  deleteTag as apiDeleteTag,
} from '../lib/api';

interface UseTagsReturn {
  tags: TagWithCount[];
  loading: boolean;
  selectedTags: Set<number>;
  tagMode: 'and' | 'or';
  setTagMode: (mode: 'and' | 'or') => void;
  toggleTag: (tagId: TagId) => void;
  createTag: (name: string) => Promise<void>;
  deleteTag: (id: TagId) => Promise<void>;
  refresh: () => void;
}

export function useTags(): UseTagsReturn {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<Set<number>>(new Set());
  const [tagMode, setTagMode] = useState<'and' | 'or'>('or');
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
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
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
      setSelectedTags((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      incrementRefreshKey();
    },
    [],
  );

  return { tags, loading, selectedTags, tagMode, setTagMode, toggleTag, createTag, deleteTag, refresh: incrementRefreshKey };
}
