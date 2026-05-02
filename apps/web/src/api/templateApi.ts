import { api } from './client';

export const templateApi = {
  async getMarkdownTemplate(): Promise<string> {
    const res = await api.get('/templates/markdown');
    return res.data.template as string;
  },
};