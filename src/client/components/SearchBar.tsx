interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  loading: boolean;
}

export function SearchBar({ query, onQueryChange, loading }: SearchBarProps) {
  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
        }}
        placeholder="Search by prompt or title..."
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {loading ? (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
        </div>
      ) : null}
    </div>
  );
}
