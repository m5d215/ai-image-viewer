import { z } from 'zod';
import {
  ImageId,
  TagId,
  FilePath,
  ThumbPath,
  Prompt,
  TagName,
  ISODateString,
} from './brands';

export const ImageRow = z.object({
  id: ImageId,
  file_path: FilePath,
  file_name: z.string(),
  title: z.string().nullable(),
  prompt: Prompt.nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  file_size: z.number().int().nullable(),
  file_mtime: ISODateString,
  thumb_path: ThumbPath.nullable(),
  created_at: ISODateString,
  updated_at: ISODateString,
});
export type ImageRow = z.infer<typeof ImageRow>;

export const TagRow = z.object({
  id: TagId,
  name: TagName,
});
export type TagRow = z.infer<typeof TagRow>;

export const ImageWithTags = ImageRow.extend({
  tags: z.array(TagRow),
});
export type ImageWithTags = z.infer<typeof ImageWithTags>;

// APIリクエスト
export const SearchQuery = z.object({
  q: z.string().min(1).max(500),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const ImagePatchBody = z.object({
  title: z.string().optional(),
});

export const TagCreateBody = z.object({
  name: TagName,
});

// APIレスポンス
export const SyncResult = z.object({
  added: z.number().int(),
  updated: z.number().int(),
  deleted: z.number().int(),
  unchanged: z.number().int(),
});
export type SyncResult = z.infer<typeof SyncResult>;
