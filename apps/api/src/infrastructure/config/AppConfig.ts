import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnv } from './EnvConfig.js';
import {
  DEFAULT_MAX_CONCURRENT_IMAGES,
  DEFAULT_MAX_CONCURRENT_TTS,
} from '@vidtoolkits/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../../..');

export interface AppConfig {
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  imageProviders: {
    pixabayKey: string | undefined;
    pexelsKey: string | undefined;
    unsplashKey: string | undefined;
  };
  voiceboxUrl: string;
  performance: {
    nodeMaxOldSpaceMB: number;
    remotionConcurrency: number;
    maxConcurrentImages: number;
    maxConcurrentTTS: number;
    cacheDiskMaxMB: number;
  };
  limits: {
    maxMdSizeKB: number;
  };
  paths: {
    dataDir: string;
    outputDir: string;
    tempDir: string;
    cacheDir: string;
    projectsDir: string;
    remotionDir: string;
  };
}

export function getAppConfig(): AppConfig {
  const env = getEnv();
  const dataDir = path.join(PROJECT_ROOT, 'data');
  const outputDir = path.join(dataDir, 'output');
  const tempDir = path.join(dataDir, 'temp');
  const cacheDir = path.join(dataDir, 'cache');
  const projectsDir = path.join(dataDir, 'projects');
  const remotionDir = path.join(PROJECT_ROOT, 'remotion');

  const autoConcurrency = Math.max(1, Math.min(os.cpus().length - 1, 4));

  return {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    frontendUrl: env.FRONTEND_URL,
    imageProviders: {
      pixabayKey: env.PIXABAY_API_KEY,
      pexelsKey: env.PEXELS_API_KEY,
      unsplashKey: env.UNSPLASH_ACCESS_KEY,
    },
    voiceboxUrl: env.VOICEBOX_URL,
    performance: {
      nodeMaxOldSpaceMB: env.NODE_MAX_OLD_SPACE_SIZE,
      remotionConcurrency: env.REMOTION_CONCURRENCY ?? autoConcurrency,
      maxConcurrentImages: DEFAULT_MAX_CONCURRENT_IMAGES,
      maxConcurrentTTS: DEFAULT_MAX_CONCURRENT_TTS,
      cacheDiskMaxMB: env.CACHE_DISK_MAX_MB,
    },
    limits: {
      maxMdSizeKB: env.MAX_MD_SIZE_KB,
    },
    paths: {
      dataDir,
      outputDir,
      tempDir,
      cacheDir,
      projectsDir,
      remotionDir,
    },
  };
}

export const CONFIG = getAppConfig();