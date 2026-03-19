import { useState, useEffect, useCallback } from 'react';
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
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchTags()
      .then((result) => {
        if (!cancelled) {
          setTags(result);
        }
      })
      .catch(() => {
        // Silently fail — tags are non-critical
      })
      .finally(() => {
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
      refresh();
    },
    [refresh],
  );

  const deleteTag = useCallback(
    async (id: TagId): Promise<void> => {
      await apiDeleteTag(id);
      setSelectedTags((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      refresh();
    },
    [refresh],
  );

  return { tags, loading, selectedTags, tagMode, setTagMode, toggleTag, createTag, deleteTag, refresh };
}
