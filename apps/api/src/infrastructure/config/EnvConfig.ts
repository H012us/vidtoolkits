import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  // Image provider API keys
  PIXABAY_API_KEY: z.string().trim().optional(),
  PEXELS_API_KEY: z.string().trim().optional(),
  UNSPLASH_ACCESS_KEY: z.string().trim().optional(),
  // Voicebox
  VOICEBOX_URL: z.string().url().default('http://127.0.0.1:17493'),
  // Performance
  NODE_MAX_OLD_SPACE_SIZE: z.coerce.number().int().min(512).max(8192).default(4096),
  REMOTION_CONCURRENCY: z.coerce.number().int().min(1).max(8).optional(),
  CACHE_DISK_MAX_MB: z.coerce.number().int().min(100).max(10240).default(2048),
  // Limits
  MAX_MD_SIZE_KB: z.coerce.number().int().min(50).max(10240).default(500),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const raw = {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    FRONTEND_URL: process.env.FRONTEND_URL,
    PIXABAY_API_KEY: process.env.PIXABAY_API_KEY,
    PEXELS_API_KEY: process.env.PEXELS_API_KEY,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    VOICEBOX_URL: process.env.VOICEBOX_URL,
    NODE_MAX_OLD_SPACE_SIZE: process.env.NODE_MAX_OLD_SPACE_SIZE,
    REMOTION_CONCURRENCY: process.env.REMOTION_CONCURRENCY,
    CACHE_DISK_MAX_MB: process.env.CACHE_DISK_MAX_MB,
    MAX_MD_SIZE_KB: process.env.MAX_MD_SIZE_KB,
  };

  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Invalid environment configuration: ${errors}`);
  }

  cached = result.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}