import { describe, it, expect, vi, beforeEach } from 'vitest';
import { templateApi } from './templateApi';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
  },
}));
import { api } from './client';

describe('templateApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getMarkdownTemplate() resolves and returns template string', async () => {
    const template = '---';
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { template } });
    const result = await templateApi.getMarkdownTemplate();
    expect(result).toBe('---');
    expect(api.get).toHaveBeenCalledWith('/templates/markdown');
  });

  it('getMarkdownTemplate() rejects and propagates error', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Not found'));
    await expect(templateApi.getMarkdownTemplate()).rejects.toThrow('Not found');
  });
});
