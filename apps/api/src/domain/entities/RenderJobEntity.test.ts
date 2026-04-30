import { describe, it, expect } from 'vitest';
import { RenderJobEntity } from './RenderJobEntity.js';

describe('RenderJobEntity', () => {
  describe('constructor', () => {
    it('assigns a new UUID', () => {
      const entity = new RenderJobEntity('project-1');
      expect(entity.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('sets projectId', () => {
      const entity = new RenderJobEntity('my-project-id');
      expect(entity.projectId).toBe('my-project-id');
    });

    it('sets initial state', () => {
      const entity = new RenderJobEntity('p1');
      expect(entity.status).toBe('queued');
      expect(entity.progress).toBe(0);
      expect(entity.currentStep).toBeNull();
      expect(entity.completedAt).toBeNull();
      expect(entity.outputPath).toBeNull();
      expect(entity.fileSize).toBeNull();
      expect(entity.error).toBeNull();
    });

    it('sets startedAt to ISO string', () => {
      const before = Date.now();
      const entity = new RenderJobEntity('p1');
      const ts = new Date(entity.startedAt).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
    });
  });

  describe('start', () => {
    it('transitions status to running', () => {
      const entity = new RenderJobEntity('p1');
      entity.start();
      expect(entity.status).toBe('running');
    });

    it('resets startedAt', () => {
      const entity = new RenderJobEntity('p1');
      const beforeMs = new Date(entity.startedAt).getTime();
      entity.start();
      const afterMs = new Date(entity.startedAt).getTime();
      expect(afterMs).toBeGreaterThanOrEqual(beforeMs);
    });
  });

  describe('setStep', () => {
    it('updates currentStep and progress', () => {
      const entity = new RenderJobEntity('p1');
      entity.start();
      entity.setStep('FETCH_IMAGES', 25);
      expect(entity.currentStep).toBe('FETCH_IMAGES');
      expect(entity.progress).toBe(25);
    });
  });

  describe('complete', () => {
    it('transitions to completed with outputPath and fileSize', () => {
      const entity = new RenderJobEntity('p1');
      entity.start();
      entity.complete('/output/video.mp4', 1_500_000);
      expect(entity.status).toBe('completed');
      expect(entity.progress).toBe(100);
      expect(entity.outputPath).toBe('/output/video.mp4');
      expect(entity.fileSize).toBe(1_500_000);
      expect(entity.completedAt).not.toBeNull();
    });
  });

  describe('fail', () => {
    it('transitions to failed with error message', () => {
      const entity = new RenderJobEntity('p1');
      entity.start();
      entity.fail('Render crashed: out of memory');
      expect(entity.status).toBe('failed');
      expect(entity.error).toBe('Render crashed: out of memory');
      expect(entity.completedAt).not.toBeNull();
    });
  });

  describe('toJSON', () => {
    it('returns a RenderJob-compatible plain object', () => {
      const entity = new RenderJobEntity('p1');
      entity.start();
      entity.setStep('RENDER_VIDEO', 85);
      const json = entity.toJSON();

      expect(json).toMatchObject({
        id: entity.id,
        projectId: 'p1',
        status: 'running',
        progress: 85,
        currentStep: 'RENDER_VIDEO',
        startedAt: entity.startedAt,
        completedAt: null,
        outputPath: null,
        fileSize: null,
        error: null,
      });
    });
  });

  describe('fromJSON', () => {
    it('reconstructs entity with working prototype methods', () => {
      const json: ReturnType<RenderJobEntity['toJSON']> = {
        id: 'job-uuid',
        projectId: 'proj-uuid',
        status: 'running',
        progress: 50,
        currentStep: 'GENERATE_TTS',
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: null,
        outputPath: null,
        fileSize: null,
        error: null,
      };

      const entity = RenderJobEntity.fromJSON(json);
      expect(entity.status).toBe('running');
      expect(entity.progress).toBe(50);

      entity.complete('/final.mp4', 1000);
      expect(entity.status).toBe('completed');
      expect(entity.outputPath).toBe('/final.mp4');
    });

    it('round-trip preserves all fields', () => {
      const original = new RenderJobEntity('proj-1');
      original.start();
      original.setStep('ASSEMBLE_COMPOSITION', 75);

      const restored = RenderJobEntity.fromJSON(original.toJSON());
      const reSerialized = restored.toJSON();

      expect(reSerialized.id).toBe(original.id);
      expect(reSerialized.projectId).toBe('proj-1');
      expect(reSerialized.status).toBe('running');
      expect(reSerialized.progress).toBe(75);
      expect(reSerialized.currentStep).toBe('ASSEMBLE_COMPOSITION');
    });
  });
});
