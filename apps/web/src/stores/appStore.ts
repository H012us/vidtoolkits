import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings } from '../types';

type ToastType = 'success' | 'error' | 'info';

interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  toasts: { id: string; message: string; type: ToastType }[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
      toasts: [],
      addToast: (message, type) => {
        const id = crypto.randomUUID();
        set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
        setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 5000);
      },
      removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
    }),
    { name: 'vidtoolkits-app' }
  )
);

interface SettingsState {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const defaultSettings: AppSettings = {
  pixabayKey: '',
  pexelsKey: '',
  unsplashKey: '',
  voicePreviewVoice: 'en-US-AriaNeural',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (updates) =>
        set(s => ({ settings: { ...s.settings, ...updates } })),
      resetSettings: () => set({ settings: defaultSettings }),
    }),
    { name: 'vidtoolkits-settings' }
  )
);