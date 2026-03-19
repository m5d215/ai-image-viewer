import { useState, useEffect, useCallback } from 'react';
import type { TagRow, TagId, ImageWithTags } from '@/shared/types';
import {
  fetchImage,
  fetchTags,
  addTagToImage,
  removeTagFromImage,
} from '../lib/api';

interface ImageDetailProps {
  imageId: number;
  onBack: () => void;
}

export function ImageDetail({ imageId, onBack }: ImageDetailProps) {
  const [image, setImage] = useState<ImageWithTags | null>(null);
  const [allTags, setAllTags] = useState<TagRow[]>([]);
  const [imageTags, setImageTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [imageData, tagsData] = await Promise.all([
        fetchImage(imageId),
        fetchTags(),
      ]);
      setImage(imageData);
      setAllTags(tagsData);
      setImageTags(imageData.tags);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load image');
    } finally {
      setLoading(false);
    }
  }, [imageId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAddTag = async (tagId: TagId) => {
    try {
      await addTagToImage(imageId, tagId);
      const tag = allTags.find((t) => t.id === tagId);
      if (tag !== undefined) {
        setImageTags((prev) => [...prev, tag]);
      }
    } catch {
      // Silently fail
    }
  };

  const handleRemoveTag = async (tagId: TagId) => {
    try {
      await removeTagFromImage(imageId, tagId);
      setImageTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch {
      // Silently fail
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (bytes === null) return 'Unknown';
    if (bytes < 1024) return `${String(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
      </div>
    );
  }

  if (error !== null || image === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error ?? 'Image not found'}</p>
        <button
          type="button"
          onClick={onBack}
          className="rounded bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300"
        >
          Back to list
        </button>
      </div>
    );
  }

  const imageTagIds = new Set(imageTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !imageTagIds.has(t.id));

  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          Back
        </button>
        <h1 className="text-lg font-semibold text-gray-900">
          {image.title ?? image.file_name}
        </h1>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        {/* Image */}
        <div className="flex flex-1 items-center justify-center rounded-lg bg-gray-100 p-4">
          <img
            src={`/api/images/${String(image.id)}/file`}
            alt={image.title ?? image.file_name}
            className="max-h-[70vh] max-w-full rounded object-contain"
          />
        </div>

        {/* Metadata sidebar */}
        <div className="w-full shrink-0 space-y-6 lg:w-80">
          {/* File info */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
              File Info
            </h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Filename</dt>
                <dd className="break-all text-gray-900">{image.file_name}</dd>
              </div>
              {image.width !== null && image.height !== null ? (
                <div>
                  <dt className="text-gray-500">Dimensions</dt>
                  <dd className="text-gray-900">
                    {String(image.width)} x {String(image.height)}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-gray-500">File Size</dt>
                <dd className="text-gray-900">{formatFileSize(image.file_size)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Modified</dt>
                <dd className="text-gray-900">
                  {new Date(image.file_mtime).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Added</dt>
                <dd className="text-gray-900">
                  {new Date(image.created_at).toLocaleString()}
                </dd>
              </div>
            </dl>
          </section>

          {/* Prompt */}
          {image.prompt !== null ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Prompt
              </h2>
              <p className="whitespace-pre-wrap rounded-lg bg-gray-100 p-3 text-sm text-gray-800">
                {image.prompt}
              </p>
            </section>
          ) : null}

          {/* Tags */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Tags
            </h2>
            {imageTags.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {imageTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700"
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => {
                        void handleRemoveTag(tag.id);
                      }}
                      className="ml-1 rounded-full p-0.5 hover:bg-blue-200"
                      aria-label={`Remove tag ${tag.name}`}
                    >
                      <svg
                        className="h-3 w-3"
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
                  </span>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-sm text-gray-400">No tags assigned</p>
            )}

            {availableTags.length > 0 ? (
              <div>
                <p className="mb-1 text-xs text-gray-500">Add a tag:</p>
                <div className="flex flex-wrap gap-1">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        void handleAddTag(tag.id);
                      }}
                      className="rounded-full border border-gray-300 px-2.5 py-0.5 text-xs text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
                    >
                      + {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
