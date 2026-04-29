import type { VideoProject } from '@vidtoolkits/shared';

export type { VideoProject } from '@vidtoolkits/shared';

export interface RenderProgress {
  step: string;
  progress: number;
  message: string;
  completed: boolean;
}

export interface AppSettings {
  pixabayKey: string;
  pexelsKey: string;
  unsplashKey: string;
  voicePreviewVoice: string;
}