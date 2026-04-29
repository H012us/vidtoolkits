import { api } from './client';
import type { VideoProject } from '@vidtoolkits/shared';

export const projectApi = {
  list: async (): Promise<VideoProject[]> => {
    const { data } = await api.get<{ projects: VideoProject[] }>('/projects');
    return data.projects;
  },

  get: async (id: string): Promise<VideoProject> => {
    const { data } = await api.get<{ project: VideoProject }>(`/projects/${id}`);
    return data.project;
  },

  update: async (id: string, updates: Partial<VideoProject>): Promise<VideoProject> => {
    const { data } = await api.patch<{ project: VideoProject }>(`/projects/${id}`, updates);
    return data.project;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },
};

export type { VideoProject } from '@vidtoolkits/shared';