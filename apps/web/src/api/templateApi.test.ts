import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { templateApi } from './templateApi';

vi.mock('axios');
const mockedAxios = axios as unknown as { [k: string]: ReturnType<typeof vi.fn> };

describe('templateApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getMarkdownTemplate() resolves and returns template string', async () => {
    const template = '---';
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { template } });
    const result = await templateApi.getMarkdownTemplate();
    expect(result).toBe('---');
    expect(mockedAxios.get).toHaveBeenCalledWith('/templates/markdown');
  });

  it('getMarkdownTemplate() rejects and propagates error', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(new Error('Not found'));
    await expect(templateApi.getMarkdownTemplate()).rejects.toThrow('Not found');
  });
});
