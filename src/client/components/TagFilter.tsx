import { useState } from 'react';
import type { TagId } from '@/shared/types';
import type { TagWithCount } from '../lib/api';

interface TagFilterProps {
  tags: TagWithCount[];
  tagFilterState: Map<number, 'include' | 'exclude'>;
  tagMode: 'and' | 'or';
  onToggleTag: (tagId: TagId) => void;
  onTagModeChange: (mode: 'and' | 'or') => void;
  onCreateTag: (name: string) => Promise<void>;
  onDeleteTag: (id: TagId) => Promise<void>;
}

export function TagFilter({
  tags,
  tagFilterState,
  tagMode,
  onToggleTag,
  onTagModeChange,
  onCreateTag,
  onDeleteTag,
}: TagFilterProps) {
  const [newTagName, setNewTagName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTag = async () => {
    if (newTagName.trim().length === 0) return;
    setIsCreating(true);
    try {
      await onCreateTag(newTagName.trim());
      setNewTagName('');
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleCreateTag();
    }
  };

  const handleToggleMode = () => {
    onTagModeChange(tagMode === 'or' ? 'and' : 'or');
  };

  const hasInclude = Array.from(tagFilterState.values()).some((v) => v === 'include');

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Tags
      </h2>

      {/* AND/OR toggle */}
      {hasInclude ? (
        <div className="mb-3">
          <button
            type="button"
            onClick={handleToggleMode}
            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            Mode: {tagMode.toUpperCase()}
          </button>
          <p className="mt-1 text-xs text-gray-400">
            {tagMode === 'and' ? 'Match all included tags' : 'Match any included tag'}
          </p>
        </div>
      ) : null}

      {tags.length === 0 ? (
        <p className="text-sm text-gray-400">No tags yet</p>
      ) : (
        <ul className="space-y-1">
          {tags.map((tag) => {
            const state = tagFilterState.get(tag.id);
            const isInclude = state === 'include';
            const isExclude = state === 'exclude';

            return (
              <li key={tag.id} className="group flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onToggleTag(tag.id);
                  }}
                  className={`flex flex-1 cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm transition-colors ${
                    isInclude
                      ? 'border-l-4 border-blue-500 bg-blue-50 text-blue-700'
                      : isExclude
                        ? 'border-l-4 border-red-400 bg-red-50 text-red-500 line-through'
                        : 'border-l-4 border-transparent text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="w-4 shrink-0 text-center text-xs font-bold">
                    {isInclude ? '+' : isExclude ? '-' : ''}
                  </span>
                  <span className="truncate">{tag.name}</span>
                  <span className="ml-auto text-xs text-gray-400">({String(tag.image_count)})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void onDeleteTag(tag.id);
                  }}
                  className="invisible rounded p-1 text-gray-400 hover:text-red-500 group-hover:visible"
                  aria-label={`Delete tag ${tag.name}`}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 border-t border-gray-200 pt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => {
              setNewTagName(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="New tag..."
            className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => {
              void handleCreateTag();
            }}
            disabled={isCreating || newTagName.trim().length === 0}
            className="rounded bg-blue-500 px-2 py-1 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </aside>
  );
}
