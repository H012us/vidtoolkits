import { api } from './client';
import type { Settings } from '@vidtoolkits/shared';

export const settingsApi = {
  async get(): Promise<Settings> {
    const res = await api.get('/settings');
    return res.data.settings;
  },

  async update(updates: Partial<Settings>): Promise<Settings> {
    const res = await api.patch('/settings', updates);
    return res.data.settings;
  },
};