import axios from 'axios';

export const templateApi = {
  async getMarkdownTemplate(): Promise<string> {
    const res = await axios.get('/templates/markdown');
    return res.data.template as string;
  },
};