import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadController } from './UploadController.js';
import type { UploadService } from '../../application/services/UploadService.js';
import { container } from '../../infrastructure/container.js';
import type { VideoProject } from '@vidtoolkits/shared';

function makeProject(overrides: Partial<VideoProject> = {}): VideoProject {
  const now = new Date().toISOString();
  return {
    id: 'proj-upload-1',
    title: 'Uploaded',
    style: 'cinematic',
    voiceName: 'en-US-AriaNeural',
    durationPerPart: 8,
    parts: [],
    status: 'created',
    createdAt: now,
    updatedAt: now,
    outputPath: null,
    error: null,
    ...overrides,
  };
}

function mockFile(overrides: any = {}) {
  return {
    fieldname: 'file',
    originalname: 'test.md',
    encoding: '7bit',
    mimetype: 'text/markdown',
    size: 1024,
    buffer: Buffer.from('# Test\n\nContent.'),
    destination: '',
    filename: 'test.md',
    path: '/tmp/test.md',
    ...overrides,
  };
}

describe('UploadController', () => {
  let controller: UploadController;
  let mockService: UploadService;

  beforeEach(() => {
    mockService = {
      uploadMarkdown: vi.fn(),
    } as unknown as UploadService;
    container.register('UploadService', mockService as any);
    controller = new UploadController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('upload', () => {
    it('returns 201 with project on success', async () => {
      const project = makeProject();
      (mockService.uploadMarkdown as any).mockResolvedValue({ project });
      const res: any = { json: vi.fn(), status: vi.fn(() => res) };
      const next = vi.fn();
      await controller.upload({ file: mockFile() } as any, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ project });
    });

    it('returns 400 when no file is uploaded', async () => {
      const res: any = { json: vi.fn(), status: vi.fn(() => res) };
      await controller.upload({ file: undefined } as any, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      const json = res.json.mock.calls[0][0];
      expect(json.error).toBe('VALIDATION_ERROR');
      expect(json.message).toBe('No file uploaded');
    });

    it('passes service errors to next', async () => {
      const err = new Error('parse failed');
      (mockService.uploadMarkdown as any).mockRejectedValue(err);
      const res: any = { json: vi.fn(), status: vi.fn(() => res) };
      const next = vi.fn();
      await controller.upload({ file: mockFile() } as any, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });

    it('calls service with the multer file object', async () => {
      const file = mockFile();
      (mockService.uploadMarkdown as any).mockResolvedValue({ project: makeProject() });
      const res: any = { json: vi.fn(), status: vi.fn(() => res) };
      await controller.upload({ file } as any, res, vi.fn());
      expect(mockService.uploadMarkdown).toHaveBeenCalledWith(file);
    });
  });
});
