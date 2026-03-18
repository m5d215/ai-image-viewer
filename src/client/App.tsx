import { useState, useEffect, useCallback } from 'react';
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

type Route = RouteHome | RouteDetail;

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
}: {
  onImageClick: (id: number) => void;
}) {
  const { images, loading, error, refresh } = useImages();
  const { query, setQuery, results, loading: searchLoading, isActive } = useSearch();
  const { tags, selectedTags, toggleTag, createTag, deleteTag } = useTags();

  const displayImages = isActive ? results : images;

  // Filter by selected tags (client-side, simple approach)
  // Note: For proper tag filtering, the API should support it.
  // This is a placeholder — tags on images aren't loaded yet in the list view.
  const filteredImages =
    selectedTags.size > 0 ? displayImages : displayImages;

  return (
    <div className="flex h-full">
      <TagFilter
        tags={tags}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
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
            <ImageGrid images={filteredImages} onImageClick={onImageClick} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- App ---

export function App() {
  const { route, navigate } = useRouter();

  const handleImageClick = useCallback(
    (id: number) => {
      navigate(`/images/${String(id)}`);
    },
    [navigate],
  );

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <button
          type="button"
          onClick={() => {
            navigate('/');
          }}
          className="text-lg font-bold text-gray-900 hover:text-blue-600"
        >
          AI Image Viewer
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {route.page === 'detail' ? (
          <ImageDetail imageId={route.imageId} onBack={handleBack} />
        ) : (
          <ImageListPage onImageClick={handleImageClick} />
        )}
      </main>
    </div>
  );
}
