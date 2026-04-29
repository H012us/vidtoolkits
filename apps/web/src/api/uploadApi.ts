import { api } from './client';
import type { VideoProject } from '@vidtoolkits/shared';

export const uploadApi = {
  uploadMarkdown: async (file: File): Promise<{ project: VideoProject }> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post<{ project: VideoProject }>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
    return data;
  },
};