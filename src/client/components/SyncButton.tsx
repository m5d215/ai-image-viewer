import { useState } from 'react';
import type { SyncResult } from '@/shared/types';
import { syncImages } from '../lib/api';

interface SyncButtonProps {
  onSyncComplete: () => void;
}

export function SyncButton({ onSyncComplete }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setToast(null);

    try {
      const result: SyncResult = await syncImages();
      const parts: string[] = [];
      if (result.added > 0) parts.push(`${String(result.added)} added`);
      if (result.updated > 0) parts.push(`${String(result.updated)} updated`);
      if (result.deleted > 0) parts.push(`${String(result.deleted)} deleted`);
      if (result.unchanged > 0) parts.push(`${String(result.unchanged)} unchanged`);

      setToast(parts.length > 0 ? parts.join(', ') : 'No changes');
      onSyncComplete();
    } catch (err: unknown) {
      setToast(err instanceof Error ? `Sync failed: ${err.message}` : 'Sync failed');
    } finally {
      setSyncing(false);
      // Auto-hide toast after 5 seconds
      setTimeout(() => {
        setToast(null);
      }, 5000);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          void handleSync();
        }}
        disabled={syncing}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {syncing ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
        ) : (
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        )}
        Sync
      </button>

      {/* Toast notification */}
      {toast !== null ? (
        <div className="absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
