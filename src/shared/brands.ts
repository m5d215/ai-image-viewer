import { z } from 'zod';

// --- ID型 ---
export const ImageId = z.number().int().positive().brand<'ImageId'>();
export type ImageId = z.infer<typeof ImageId>;

export const TagId = z.number().int().positive().brand<'TagId'>();
export type TagId = z.infer<typeof TagId>;

// --- パス型 ---
export const FilePath = z.string().min(1).brand<'FilePath'>();
export type FilePath = z.infer<typeof FilePath>;

export const ThumbPath = z.string().min(1).brand<'ThumbPath'>();
export type ThumbPath = z.infer<typeof ThumbPath>;

// --- ドメイン値 ---
export const Prompt = z.string().brand<'Prompt'>();
export type Prompt = z.infer<typeof Prompt>;

export const TagName = z.string().min(1).max(100).brand<'TagName'>();
export type TagName = z.infer<typeof TagName>;

export const ISODateString = z.iso.datetime().brand<'ISODateString'>();
export type ISODateString = z.infer<typeof ISODateString>;
