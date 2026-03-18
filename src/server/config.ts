import { z } from 'zod';

const EnvSchema = z.object({
  IMAGE_DIR: z.string().min(1).default('/images'),
  DB_PATH: z.string().min(1).default('/data/db/viewer.db'),
  THUMB_DIR: z.string().min(1).default('/data/thumbnails'),
  PORT: z.coerce.number().int().positive().default(3000),
  AUTH_USER: z.string().min(1).optional(),
  AUTH_PASS: z.string().min(1).optional(),
});

export const env = EnvSchema.parse(process.env);

export const exifFieldMapping = {
  prompt: 'description',
  title: 'title',
} as const;
