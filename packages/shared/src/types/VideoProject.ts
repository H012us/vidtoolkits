import { z } from 'zod';

export const MediaAssetSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  source: z.enum(['pixabay', 'pexels', 'unsplash']),
  sourceId: z.string(),
  alt: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  attribution: z.string(),
  localPath: z.string().optional(),
});

export const VideoPartSchema = z.object({
  partIndex: z.number().int().min(0),
  title: z.string(),
  script: z.string(),
  keywords: z.array(z.string()),
  images: z.array(MediaAssetSchema),
  ttsPath: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
});

export const VideoProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  style: z.enum(['cinematic', 'minimal', 'bold']).default('cinematic'),
  voiceName: z.string().default('en-US-AriaNeural'),
  durationPerPart: z.number().int().min(1).max(60).default(8),
  parts: z.array(VideoPartSchema),
  status: z.enum(['created', 'processing', 'completed', 'failed']),
  createdAt: z.string(),
  updatedAt: z.string(),
  outputPath: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  rawMarkdown: z.string(),
});

export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type VideoPart = z.infer<typeof VideoPartSchema>;
export type VideoProject = z.infer<typeof VideoProjectSchema>;