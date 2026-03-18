import { z } from 'zod';
import { ImageRow, TagRow, SyncResult } from '@/shared/schemas';
import { ImageId, TagId, TagName } from '@/shared/brands';
import type { ImageRow as ImageRowType, TagRow as TagRowType, SyncResult as SyncResultType } from '@/shared/types';

// --- Response schemas ---

const ImageListResponse = z.object({
  data: z.array(ImageRow),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});

const TagListResponse = z.array(TagRow);

const SyncStatusResponse = z.object({
  lastSyncAt: z.string().nullable(),
  lastResult: SyncResult.nullable(),
});
export type SyncStatus = z.infer<typeof SyncStatusResponse>;

// --- Helpers ---

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request(url: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text);
  }
  return response.json();
}

// --- Image APIs ---

export async function fetchImages(
  page: number,
  limit: number,
  sort?: string,
): Promise<z.infer<typeof ImageListResponse>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (sort !== undefined) {
    params.set('sort', sort);
  }
  const data = await request(`/api/images?${params.toString()}`);
  return ImageListResponse.parse(data);
}

export async function fetchImage(id: number): Promise<ImageRowType> {
  const parsedId = ImageId.parse(id);
  const data = await request(`/api/images/${String(parsedId)}`);
  return ImageRow.parse(data);
}

export async function searchImages(
  query: string,
  page: number,
  limit: number,
): Promise<z.infer<typeof ImageListResponse>> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    limit: String(limit),
  });
  const data = await request(`/api/images/search?${params.toString()}`);
  return ImageListResponse.parse(data);
}

export async function updateImage(
  id: number,
  body: { title?: string },
): Promise<ImageRowType> {
  const parsedId = ImageId.parse(id);
  const data = await request(`/api/images/${String(parsedId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return ImageRow.parse(data);
}

// --- Sync APIs ---

export async function syncImages(): Promise<SyncResultType> {
  const data = await request('/api/sync', { method: 'POST' });
  return SyncResult.parse(data);
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
  const data = await request('/api/sync/status');
  return SyncStatusResponse.parse(data);
}

// --- Tag APIs ---

export async function fetchTags(): Promise<TagRowType[]> {
  const data = await request('/api/tags');
  return TagListResponse.parse(data);
}

export async function createTag(name: string): Promise<TagRowType> {
  const parsedName = TagName.parse(name);
  const data = await request('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: parsedName }),
  });
  return TagRow.parse(data);
}

export async function deleteTag(id: number): Promise<void> {
  const parsedId = TagId.parse(id);
  await request(`/api/tags/${String(parsedId)}`, { method: 'DELETE' });
}

export async function addTagToImage(
  imageId: number,
  tagId: number,
): Promise<void> {
  const parsedImageId = ImageId.parse(imageId);
  const parsedTagId = TagId.parse(tagId);
  await request(`/api/images/${String(parsedImageId)}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tagId: parsedTagId }),
  });
}

export async function removeTagFromImage(
  imageId: number,
  tagId: number,
): Promise<void> {
  const parsedImageId = ImageId.parse(imageId);
  const parsedTagId = TagId.parse(tagId);
  await request(
    `/api/images/${String(parsedImageId)}/tags/${String(parsedTagId)}`,
    { method: 'DELETE' },
  );
}
