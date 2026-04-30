import axios from 'axios';
import type { Settings } from '@vidtoolkits/shared';

export const settingsApi = {
  async get(): Promise<Settings> {
    const res = await axios.get('/settings');
    return res.data.settings;
  },

  async update(updates: Partial<Settings>): Promise<Settings> {
    const res = await axios.patch('/settings', updates);
    return res.data.settings;
  },
};