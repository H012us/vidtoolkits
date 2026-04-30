import { z } from 'zod';

export const SettingsSchema = z.object({
  pixabayKey: z.string().default(''),
  pexelsKey: z.string().default(''),
  unsplashKey: z.string().default(''),
  voicePreviewVoice: z.string().default('en-US-AriaNeural'),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  pixabayKey: '',
  pexelsKey: '',
  unsplashKey: '',
  voicePreviewVoice: 'en-US-AriaNeural',
};

export const DEFAULT_SETTINGS_FILE = 'settings.json';