import { useState, useEffect } from 'react';
import type { ImageWithTags } from '@/shared/types';
import { fetchImage } from '../lib/api';

interface CompareViewProps {
  imageIds: number[];
  onBack: () => void;
}

interface DiffSegment {
  text: string;
  type: 'same' | 'added' | 'removed';
}

function getCell(dp: number[][], i: number, j: number): number {
  const row = dp[i];
  if (row === undefined) return 0;
  return row[j] ?? 0;
}

function diffWords(a: string, b: string): DiffSegment[] {
  const wordsA = a.split(/\s+/).filter((w) => w.length > 0);
  const wordsB = b.split(/\s+/).filter((w) => w.length > 0);

  const m = wordsA.length;
  const n = wordsB.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const wordA = wordsA[i - 1];
      const wordB = wordsB[j - 1];
      const row = dp[i];
      if (row === undefined || wordA === undefined || wordB === undefined) continue;
      if (wordA === wordB) {
        row[j] = getCell(dp, i - 1, j - 1) + 1;
      } else {
        row[j] = Math.max(getCell(dp, i - 1, j), getCell(dp, i, j - 1));
      }
    }
  }

  // Backtrack to build diff
  let i = m;
  let j = n;

  const stack: DiffSegment[] = [];
  while (i > 0 || j > 0) {
    const wordA = i > 0 ? wordsA[i - 1] : undefined;
    const wordB = j > 0 ? wordsB[j - 1] : undefined;

    if (i > 0 && j > 0 && wordA !== undefined && wordB !== undefined && wordA === wordB) {
      stack.push({ text: wordA, type: 'same' });
      i--;
      j--;
    } else if (
      j > 0 &&
      wordB !== undefined &&
      (i === 0 || getCell(dp, i, j - 1) >= getCell(dp, i - 1, j))
    ) {
      stack.push({ text: wordB, type: 'added' });
      j--;
    } else if (i > 0 && wordA !== undefined) {
      stack.push({ text: wordA, type: 'removed' });
      i--;
    } else {
      break;
    }
  }

  // Reverse since we built it backwards
  const segments: DiffSegment[] = [];
  for (let k = stack.length - 1; k >= 0; k--) {
    const segment = stack[k];
    if (segment !== undefined) {
      segments.push(segment);
    }
  }

  return segments;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return 'Unknown';
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImageCard({ image }: { image: ImageWithTags }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Image */}
      <div className="flex items-center justify-center bg-gray-100 p-4">
        <img
          src={`/api/images/${String(image.id)}/file`}
          alt={image.title ?? image.file_name}
          className="max-h-[400px] max-w-full rounded object-contain"
        />
      </div>

      {/* Info */}
      <div className="space-y-4 p-4">
        {/* Title */}
        <h3 className="text-base font-semibold text-gray-900">{image.title ?? image.file_name}</h3>

        {/* Metadata */}
        <dl className="space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-gray-500">Filename:</dt>
            <dd className="break-all text-gray-900">{image.file_name}</dd>
          </div>
          {image.width !== null && image.height !== null ? (
            <div className="flex gap-2">
              <dt className="text-gray-500">Dimensions:</dt>
              <dd className="text-gray-900">
                {String(image.width)} x {String(image.height)}
              </dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="text-gray-500">Size:</dt>
            <dd className="text-gray-900">{formatFileSize(image.file_size)}</dd>
          </div>
        </dl>

        {/* Prompt */}
        {image.prompt !== null ? (
          <div>
            <h4 className="mb-1 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Prompt
            </h4>
            <p className="whitespace-pre-wrap rounded-lg bg-gray-100 p-3 text-sm text-gray-800">
              {image.prompt}
            </p>
          </div>
        ) : null}

        {/* Tags */}
        {image.tags.length > 0 ? (
          <div>
            <h4 className="mb-1 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Tags
            </h4>
            <div className="flex flex-wrap gap-1">
              {image.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PromptDiff({ images }: { images: ImageWithTags[] }) {
  if (images.length !== 2) return null;

  const imageA = images[0];
  const imageB = images[1];
  if (imageA === undefined || imageB === undefined) return null;

  const promptA = imageA.prompt ?? '';
  const promptB = imageB.prompt ?? '';

  if (promptA.length === 0 && promptB.length === 0) return null;

  const segments = diffWords(promptA, promptB);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Prompt Diff
      </h3>
      <div className="flex gap-4 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-200" />
          Removed (from first)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-green-200" />
          Added (in second)
        </span>
      </div>
      <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-relaxed">
        {segments.map((segment, index) => {
          if (segment.type === 'added') {
            return (
              <span key={index} className="rounded bg-green-200 px-0.5">
                {segment.text}{' '}
              </span>
            );
          }
          if (segment.type === 'removed') {
            return (
              <span key={index} className="rounded bg-red-200 px-0.5 line-through">
                {segment.text}{' '}
              </span>
            );
          }
          return <span key={index}>{segment.text} </span>;
        })}
      </p>
    </div>
  );
}

export function CompareView({ imageIds, onBack }: CompareViewProps) {
  const [images, setImages] = useState<ImageWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadImages = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.all(imageIds.map((id) => fetchImage(id)));
        if (!cancelled) {
          setImages(results);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load images');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadImages();

    return () => {
      cancelled = true;
    };
  }, [imageIds]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error}</p>
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
          Comparing {String(images.length)} images
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Side by side images */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {images.map((image) => (
            <ImageCard key={image.id} image={image} />
          ))}
        </div>

        {/* Prompt diff for exactly 2 images */}
        {images.length === 2 ? <PromptDiff images={images} /> : null}
      </div>
    </div>
  );
}
