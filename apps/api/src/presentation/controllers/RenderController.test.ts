import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenderController } from './RenderController.js';
import type { RenderService } from '../../application/services/RenderService.js';
import type { SSEManager } from '../SSE/SSEManager.js';
import { container } from '../../infrastructure/container.js';
import { NotFoundError } from '../../domain/errors/index.js';

function makeJob(overrides: any = {}) {
  return {
    id: 'job-1',
    projectId: 'proj-1',
    status: 'queued',
    progress: 0,
    currentStep: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    outputPath: null,
    fileSize: null,
    error: null,
    ...overrides,
  };
}

describe('RenderController', () => {
  let controller: RenderController;
  let mockService: RenderService;
  let mockSSE: SSEManager;

  beforeEach(() => {
    mockService = {
      startRender: vi.fn(),
      getJobStatus: vi.fn(),
    } as unknown as RenderService;

    mockSSE = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    } as unknown as SSEManager;

    container.register('RenderService', mockService as any);
    container.register('SSEManager', mockSSE as any);
    controller = new RenderController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockReq(overrides: any = {}) {
    return { params: {}, ...overrides, on: vi.fn() } as any;
  }

  function mockRes() {
    const res: any = {
      json: vi.fn(),
      status: vi.fn(() => res),
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      download: vi.fn(),
    };
    return res;
  }

  describe('start', () => {
    it('returns job with 202', async () => {
      const job = makeJob({ status: 'running' });
      (mockService.startRender as any).mockResolvedValue(job);
      const res = mockRes();
      await controller.start(mockReq({ params: { id: 'proj-1' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({ job });
    });

    it('passes errors to next', async () => {
      const err = new Error('boom');
      (mockService.startRender as any).mockRejectedValue(err);
      const next = vi.fn();
      await controller.start(mockReq({ params: { id: 'proj-1' } }), mockRes(), next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('status', () => {
    it('sets SSE headers and subscribes to SSE manager', async () => {
      (mockService.getJobStatus as any).mockResolvedValue(makeJob());
      const res = mockRes();
      await controller.status(mockReq({ params: { id: 'proj-1' } }), res, vi.fn());
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(res.flushHeaders).toHaveBeenCalled();
      expect(mockSSE.subscribe).toHaveBeenCalledWith('proj-1', res);
    });

    it('unsubscribes on req close', async () => {
      (mockService.getJobStatus as any).mockResolvedValue(makeJob());
      const req = mockReq({ params: { id: 'proj-1' } });
      const res = mockRes();
      await controller.status(req, res, vi.fn());
      const closeHandler = req.on.mock.calls.find((c: any) => c[0] === 'close')?.[1];
      expect(closeHandler).toBeDefined();
      closeHandler();
      expect(mockSSE.unsubscribe).toHaveBeenCalledWith('proj-1', res);
    });

    it('throws NotFoundError when job not found', async () => {
      (mockService.getJobStatus as any).mockResolvedValue(null);
      const next = vi.fn();
      await controller.status(mockReq({ params: { id: 'ghost' } }), mockRes(), next);
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });

  describe('download', () => {
    it('calls res.download with correct path and filename', async () => {
      const job = makeJob({ outputPath: '/data/output/my_video.mp4' });
      (mockService.getJobStatus as any).mockResolvedValue(job);
      const res = mockRes();
      await controller.download(mockReq({ params: { id: 'proj-1' } }), res, vi.fn());
      expect(res.download).toHaveBeenCalledWith('/data/output/my_video.mp4', 'my_video.mp4');
    });

    it('returns 404 NOT_READY when outputPath is null', async () => {
      const job = makeJob({ outputPath: null });
      (mockService.getJobStatus as any).mockResolvedValue(job);
      const res = mockRes();
      await controller.download(mockReq({ params: { id: 'proj-1' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
      const json = res.json.mock.calls[0][0];
      expect(json.error).toBe('NOT_READY');
    });

    it('throws NotFoundError when job not found', async () => {
      (mockService.getJobStatus as any).mockResolvedValue(null);
      const next = vi.fn();
      await controller.download(mockReq({ params: { id: 'ghost' } }), mockRes(), next);
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });
});
