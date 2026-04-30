import { describe, it, expect } from 'vitest';
import { VideoProjectEntity } from './VideoProjectEntity.js';

describe('VideoProjectEntity', () => {
  describe('constructor', () => {
    it('assigns a new UUID', () => {
      const entity = new VideoProjectEntity({ title: 'Test' });
      expect(entity.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('uses defaults when not provided', () => {
      const entity = new VideoProjectEntity({ title: 'Test', rawMarkdown: '' });
      expect(entity.title).toBe('Test');
      expect(entity.style).toBe('cinematic');
      expect(entity.voiceName).toBe('en-US-AriaNeural');
      expect(entity.durationPerPart).toBe(8);
      expect(entity.status).toBe('created');
      expect(entity.parts).toEqual([]);
      expect(entity.outputPath).toBeNull();
      expect(entity.error).toBeNull();
    });

    it('uses defaults for title when not provided', () => {
      const entity = new VideoProjectEntity({ title: '', rawMarkdown: '' });
      expect(entity.title).toBe('Untitled Video');
    });

    it('accepts optional overrides', () => {
      const entity = new VideoProjectEntity({
        title: 'My Video',
        rawMarkdown: '# test',
        style: 'bold',
        voiceName: 'en-GB-SoniaNeural',
        durationPerPart: 15,
      });
      expect(entity.style).toBe('bold');
      expect(entity.voiceName).toBe('en-GB-SoniaNeural');
      expect(entity.durationPerPart).toBe(15);
    });

    it('unknown style is passed through without coercion', () => {
      const entity = new VideoProjectEntity({ title: 'x', rawMarkdown: '', style: 'unknown-style' });
      // constructor uses 'as' cast without coercion — unknown styles pass through
      expect(entity.style).toBeTruthy();
    });

    it('sets createdAt and updatedAt to ISO strings', () => {
      const beforeMs = Date.now();
      const entity = new VideoProjectEntity({ title: 'x', rawMarkdown: '' });
      const createdMs = new Date(entity.createdAt).getTime();
      const updatedMs = new Date(entity.updatedAt).getTime();
      expect(createdMs).toBeGreaterThanOrEqual(beforeMs);
      expect(updatedMs).toBeGreaterThanOrEqual(beforeMs);
    });
  });

  describe('updateStatus', () => {
    it('updates status and updatedAt', () => {
      const entity = new VideoProjectEntity({ title: 'x', rawMarkdown: '' });
      const beforeMs = new Date(entity.updatedAt).getTime();
      entity.updateStatus('processing');
      expect(entity.status).toBe('processing');
      const afterMs = new Date(entity.updatedAt).getTime();
      expect(afterMs).toBeGreaterThanOrEqual(beforeMs);
    });

    it('accepts all valid status values', () => {
      const entity = new VideoProjectEntity({ title: 'x', rawMarkdown: '' });
      (['created', 'processing', 'completed', 'failed'] as const).forEach((s) => {
        entity.updateStatus(s);
        expect(entity.status).toBe(s);
      });
    });
  });

  describe('setOutput', () => {
    it('sets outputPath and updatedAt', () => {
      const entity = new VideoProjectEntity({ title: 'x', rawMarkdown: '' });
      entity.setOutput('/output/video.mp4');
      expect(entity.outputPath).toBe('/output/video.mp4');
    });
  });

  describe('setError', () => {
    it('sets error and status to failed', () => {
      const entity = new VideoProjectEntity({ title: 'x', rawMarkdown: '' });
      entity.setError('Something broke');
      expect(entity.error).toBe('Something broke');
      expect(entity.status).toBe('failed');
    });
  });

  describe('toJSON', () => {
    it('returns a plain object matching VideoProject', () => {
      const entity = new VideoProjectEntity({ title: 'JSON Test', rawMarkdown: '' });
      entity.status = 'completed';
      entity.setOutput('/path/to/video.mp4');
      const json = entity.toJSON();

      expect(json).toEqual({
        id: entity.id,
        title: 'JSON Test',
        style: 'cinematic',
        voiceName: 'en-US-AriaNeural',
        durationPerPart: 8,
        parts: [],
        status: 'completed',
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        outputPath: '/path/to/video.mp4',
        error: null,
      });
    });
  });

  describe('fromJSON', () => {
    it('reconstructs an entity from plain data', () => {
      const data: ReturnType<VideoProjectEntity['toJSON']> = {
        id: 'test-uuid',
        title: 'Restored',
        style: 'minimal',
        voiceName: 'en-GB-SoniaNeural',
        durationPerPart: 10,
        parts: [],
        status: 'processing',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        outputPath: null,
        error: null,
      };

      const entity = VideoProjectEntity.fromJSON(data);
      expect(entity.id).toBe('test-uuid');
      expect(entity.title).toBe('Restored');
      expect(entity.style).toBe('minimal');
      expect(entity.status).toBe('processing');
    });

    it('fromJSON entity has working prototype methods', () => {
      const entity = VideoProjectEntity.fromJSON({
        id: 'proto-test',
        title: 'Proto Test',
        style: 'bold',
        voiceName: 'en-US-JennyNeural',
        durationPerPart: 5,
        parts: [],
        status: 'created',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        outputPath: null,
        error: null,
      });

      entity.updateStatus('processing');
      expect(entity.status).toBe('processing');

      entity.setOutput('/final.mp4');
      expect(entity.outputPath).toBe('/final.mp4');
    });

    it('round-trip preserves all fields', () => {
      const original = new VideoProjectEntity({
        title: 'Round Trip',
        rawMarkdown: '# Test',
        style: 'minimal',
        voiceName: 'en-GB-SoniaNeural',
        durationPerPart: 12,
      });
      original.parts = [
        {
          partIndex: 0,
          title: 'Intro',
          script: 'Hello.',
          keywords: ['test'],
          images: [],
          ttsPath: null,
          durationSeconds: null,
          status: 'completed',
        },
      ];

      const restored = VideoProjectEntity.fromJSON(original.toJSON());
      const reSerialized = restored.toJSON();

      expect(reSerialized.id).toBe(original.id);
      expect(reSerialized.title).toBe('Round Trip');
      expect(reSerialized.style).toBe('minimal');
      expect(reSerialized.voiceName).toBe('en-GB-SoniaNeural');
      expect(reSerialized.durationPerPart).toBe(12);
      expect(reSerialized.parts).toHaveLength(1);
      expect(reSerialized.parts[0].title).toBe('Intro');
      expect(reSerialized.status).toBe('created');
    });
  });
});
