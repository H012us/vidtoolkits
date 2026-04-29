import { api } from './client';

export interface RenderJob {
  id: string;
  projectId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep: string | null;
  startedAt: string;
  completedAt: string | null;
  outputPath: string | null;
  fileSize: number | null;
  error: string | null;
}

export interface SSEEvent {
  type: 'step' | 'progress' | 'error' | 'complete' | 'heartbeat';
  step?: string;
  progress?: number;
  message?: string;
  data?: unknown;
  timestamp: string;
}

export const renderApi = {
  start: async (projectId: string): Promise<{ job: RenderJob }> => {
    const { data } = await api.post<{ job: RenderJob }>(`/render/${projectId}/start`);
    return data;
  },

  getStatus: (projectId: string): EventSource => {
    return new EventSource(`/api/render/${projectId}/status`);
  },

  getDownloadUrl: (projectId: string): string => {
    return `/api/render/${projectId}/download`;
  },
};