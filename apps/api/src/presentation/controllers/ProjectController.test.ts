import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectController } from './ProjectController.js';
import type { ProjectService } from '../../application/services/ProjectService.js';
import { container } from '../../infrastructure/container.js';
import { NotFoundError } from '../../domain/errors/index.js';
import type { VideoProject } from '@vidtoolkits/shared';

function makeVideoProject(overrides: Partial<VideoProject> = {}): VideoProject {
  const now = new Date().toISOString();
  return {
    id: 'proj-1',
    title: 'Test Project',
    style: 'cinematic',
    voiceName: 'en-US-AriaNeural',
    durationPerPart: 8,
    parts: [],
    status: 'created',
    createdAt: now,
    updatedAt: now,
    outputPath: null,
    error: null,
    rawMarkdown: '# Test Project\n\nSome content.',
    ...overrides,
  };
}

describe('ProjectController', () => {
  let controller: ProjectController;
  let mockService: ProjectService;

  beforeEach(() => {
    mockService = {
      listProjects: vi.fn(),
      getProject: vi.fn(),
      updateProject: vi.fn(),
      deleteProject: vi.fn(),
      createProject: vi.fn(),
    } as unknown as ProjectService;

    container.register('ProjectService', mockService as any);
    controller = new ProjectController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockReq(overrides: any = {}) {
    return { params: {}, body: {}, ...overrides } as any;
  }

  function mockRes() {
    const res: any = {
      json: vi.fn(),
      status: vi.fn(() => res),
      send: vi.fn(),
    };
    return res;
  }

  describe('list', () => {
    it('returns projects list with 200', async () => {
      const projects = [makeVideoProject({ id: 'p1' }), makeVideoProject({ id: 'p2' })];
      (mockService.listProjects as any).mockResolvedValue(projects);
      const res = mockRes();
      await controller.list(mockReq(), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith({ projects });
    });

    it('passes errors to next', async () => {
      const err = new Error('db fail');
      (mockService.listProjects as any).mockRejectedValue(err);
      const next = vi.fn();
      await controller.list(mockReq(), mockRes(), next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('getById', () => {
    it('returns project with 200', async () => {
      const project = makeVideoProject({ id: 'proj-get' });
      (mockService.getProject as any).mockResolvedValue(project);
      const res = mockRes();
      await controller.getById(mockReq({ params: { id: 'proj-get' } }), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith({ project });
    });

    it('throws NotFoundError when project not found', async () => {
      (mockService.getProject as any).mockResolvedValue(null);
      const res = mockRes();
      const next = vi.fn();
      await controller.getById(mockReq({ params: { id: 'ghost' } }), res, next);
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(NotFoundError);
    });
  });

  describe('update', () => {
    it('returns updated project with 200', async () => {
      const project = makeVideoProject({ id: 'proj-upd', title: 'Updated Title' });
      (mockService.updateProject as any).mockResolvedValue(project);
      const res = mockRes();
      await controller.update(mockReq({ params: { id: 'proj-upd' }, body: { title: 'Updated Title' } }), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith({ project });
    });

    it('throws NotFoundError when project not found', async () => {
      (mockService.updateProject as any).mockResolvedValue(null);
      const res = mockRes();
      const next = vi.fn();
      await controller.update(mockReq({ params: { id: 'ghost' } }), res, next);
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });
  });

  describe('delete', () => {
    it('returns 204', async () => {
      (mockService.deleteProject as any).mockResolvedValue(undefined);
      const res = mockRes();
      await controller.delete(mockReq({ params: { id: 'proj-del' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('passes errors to next', async () => {
      const err = new NotFoundError('Project', 'ghost');
      (mockService.deleteProject as any).mockRejectedValue(err);
      const res = mockRes();
      const next = vi.fn();
      await controller.delete(mockReq({ params: { id: 'ghost' } }), res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
