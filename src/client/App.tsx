import { useState, useEffect, useCallback, useMemo } from 'react';
import type { TagWithCount } from './lib/api';
import { bulkAddTag } from './lib/api';
import { CompareView } from './components/CompareView';
import { ImageDetail } from './components/ImageDetail';
import { ImageGrid } from './components/ImageGrid';
import { SearchBar } from './components/SearchBar';
import { SyncButton } from './components/SyncButton';
import { TagFilter } from './components/TagFilter';
import { useImages } from './hooks/useImages';
import { useSearch } from './hooks/useSearch';
import { useTags } from './hooks/useTags';

// --- Minimal router ---

interface RouteHome {
  page: 'home';
}

interface RouteDetail {
  page: 'detail';
  imageId: number;
}

interface RouteCompare {
  page: 'compare';
  imageIds: number[];
}

type Route = RouteHome | RouteDetail | RouteCompare;

function parseRoute(path: string): Route {
  const match = /^\/images\/(\d+)$/.exec(path);
  if (match !== null) {
    const id = match[1];
    if (id !== undefined) {
      return { page: 'detail', imageId: Number(id) };
    }
  }
  return { page: 'home' };
}

function useRouter(): { route: Route; navigate: (path: string) => void } {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = useCallback((path: string) => {
    window.history.pushState(null, '', path);
    setRoute(parseRoute(path));
  }, []);

  return { route, navigate };
}

// --- Pages ---

function ImageListPage({
  onImageClick,
  onCompare,
}: {
  onImageClick: (id: number) => void;
  onCompare: (imageIds: number[]) => void;
}) {
  const { tags, selectedTags, tagMode, setTagMode, toggleTag, createTag, deleteTag, refresh: refreshTags } = useTags();

  const imagesOptions = useMemo((): { limit?: number; tagIds?: number[]; tagMode?: 'and' | 'or' | 'not' } => {
    if (selectedTags.size > 0) {
      return { tagIds: Array.from(selectedTags), tagMode };
    }
    return {};
  }, [selectedTags, tagMode]);

  const { images, loading, loadingMore, hasMore, error, refresh, loadMore } = useImages(imagesOptions);
  const { query, setQuery, results, loading: searchLoading, isActive } = useSearch();

  const displayImages = isActive ? results : images;

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [bulkTagId, setBulkTagId] = useState<number | null>(null);
  const [applyingBulk, setApplyingBulk] = useState(false);

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedImages(new Set());
    }
    setSelectionMode((prev) => !prev);
  };

  const handleApplyBulkTag = async () => {
    if (bulkTagId === null || selectedImages.size === 0) return;
    setApplyingBulk(true);
    try {
      await bulkAddTag(Array.from(selectedImages), bulkTagId);
      setSelectedImages(new Set());
      setSelectionMode(false);
      setBulkTagId(null);
      refresh();
      refreshTags();
    } finally {
      setApplyingBulk(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        <TagFilter
          tags={tags}
          selectedTags={selectedTags}
          tagMode={tagMode}
          onToggleTag={toggleTag}
          onTagModeChange={setTagMode}
          onCreateTag={createTag}
          onDeleteTag={deleteTag}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-3">
            <div className="flex-1">
              <SearchBar
                query={query}
                onQueryChange={setQuery}
                loading={searchLoading}
              />
            </div>
            <button
              type="button"
              onClick={handleToggleSelectionMode}
              className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                selectionMode
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {selectionMode ? 'Cancel Select' : 'Select'}
            </button>
            <SyncButton onSyncComplete={refresh} />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden p-4">
            {error !== null ? (
              <div className="flex h-full items-center justify-center text-red-500">
                {error}
              </div>
            ) : loading && !isActive ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
              </div>
            ) : (
              <ImageGrid
                images={displayImages}
                onImageClick={onImageClick}
                selectionMode={selectionMode}
                selectedImages={selectedImages}
                onToggleSelect={handleToggleSelect}
                hasMore={isActive ? false : hasMore}
                loadMore={loadMore}
                loadingMore={loadingMore}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectionMode && selectedImages.size > 0 ? (
        <div className="flex items-center gap-4 border-t border-gray-200 bg-white px-6 py-3 shadow-lg">
          <span className="text-sm font-medium text-gray-700">
            {String(selectedImages.size)} image{selectedImages.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <select
              value={bulkTagId !== null ? String(bulkTagId) : ''}
              onChange={(e) => {
                const val = e.target.value;
                setBulkTagId(val.length > 0 ? Number(val) : null);
              }}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select tag...</option>
              {tags.map((tag: TagWithCount) => (
                <option key={tag.id} value={String(tag.id)}>
                  {tag.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                void handleApplyBulkTag();
              }}
              disabled={bulkTagId === null || applyingBulk}
              className="rounded bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {applyingBulk ? 'Applying...' : 'Apply'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              onCompare(Array.from(selectedImages));
            }}
            disabled={selectedImages.size < 2}
            className="rounded bg-purple-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-50"
          >
            Compare
          </button>
        </div>
      ) : null}
    </div>
  );
}

// --- App ---

export function App() {
  const { route, navigate } = useRouter();
  const [compareRoute, setCompareRoute] = useState<RouteCompare | null>(null);

  const handleImageClick = useCallback(
    (id: number) => {
      navigate(`/images/${String(id)}`);
    },
    [navigate],
  );

  const handleBack = useCallback(() => {
    setCompareRoute(null);
    navigate('/');
  }, [navigate]);

  const handleCompare = useCallback((imageIds: number[]) => {
    setCompareRoute({ page: 'compare', imageIds });
  }, []);

  const currentPage = compareRoute ?? route;

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <button
          type="button"
          onClick={() => {
            setCompareRoute(null);
            navigate('/');
          }}
          className="text-lg font-bold text-gray-900 hover:text-blue-600"
        >
          AI Image Viewer
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {currentPage.page === 'compare' ? (
          <CompareView imageIds={currentPage.imageIds} onBack={handleBack} />
        ) : currentPage.page === 'detail' ? (
          <ImageDetail imageId={currentPage.imageId} onBack={handleBack} />
        ) : (
          <ImageListPage onImageClick={handleImageClick} onCompare={handleCompare} />
        )}
      </main>
    </div>
  );
}
