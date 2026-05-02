import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SettingsService } from './SettingsService.js';
import { withTempDir } from '../../__tests__/helpers/tempDir.js';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('SettingsService', () => {
  const defaultSettings = {
    pixabayKey: '',
    pexelsKey: '',
    unsplashKey: '',
    voicePreviewVoice: 'en-US-AriaNeural',
  };

  it('get() returns default settings when file does not exist', async () => {
    await withTempDir(async (dir) => {
      const service = new SettingsService(dir);
      const settings = await service.get();
      expect(settings).toEqual(defaultSettings);
    });
  });

  it('get() merges defaults with partial file contents', async () => {
    await withTempDir(async (dir) => {
      await fs.writeFile(path.join(dir, 'settings.json'), JSON.stringify({ pixabayKey: 'abc123' }), 'utf-8');
      const service = new SettingsService(dir);
      const settings = await service.get();
      expect(settings.pixabayKey).toBe('abc123');
      expect(settings.pexelsKey).toBe('');
      expect(settings.unsplashKey).toBe('');
      expect(settings.voicePreviewVoice).toBe('en-US-AriaNeural');
    });
  });

  it('get() returns file values exactly when all fields present', async () => {
    await withTempDir(async (dir) => {
      const full = { pixabayKey: 'key1', pexelsKey: 'key2', unsplashKey: 'key3', voicePreviewVoice: 'en-GB-SoniaNeural' };
      await fs.writeFile(path.join(dir, 'settings.json'), JSON.stringify(full), 'utf-8');
      const service = new SettingsService(dir);
      const settings = await service.get();
      expect(settings).toEqual(full);
    });
  });

  it('get() returns defaults when file has invalid JSON', async () => {
    await withTempDir(async (dir) => {
      await fs.writeFile(path.join(dir, 'settings.json'), 'not valid json{', 'utf-8');
      const service = new SettingsService(dir);
      const settings = await service.get();
      expect(settings).toEqual(defaultSettings);
    });
  });

  it('update() writes partial settings merged with current', async () => {
    await withTempDir(async (dir) => {
      const service = new SettingsService(dir);
      const updated = await service.update({ pixabayKey: 'pix-key' });
      expect(updated.pixabayKey).toBe('pix-key');
      expect(updated.pexelsKey).toBe('');
      expect(updated.unsplashKey).toBe('');
      expect(updated.voicePreviewVoice).toBe('en-US-AriaNeural');

      const fileContent = await fs.readFile(path.join(dir, 'settings.json'), 'utf-8');
      expect(JSON.parse(fileContent)).toEqual(updated);
    });
  });

  it('update() with empty object writes defaults', async () => {
    await withTempDir(async (dir) => {
      const service = new SettingsService(dir);
      const updated = await service.update({});
      expect(updated).toEqual(defaultSettings);

      const fileContent = await fs.readFile(path.join(dir, 'settings.json'), 'utf-8');
      expect(JSON.parse(fileContent)).toEqual(defaultSettings);
    });
  });

  it('update() then get() round-trips persisted values', async () => {
    await withTempDir(async (dir) => {
      const service = new SettingsService(dir);
      await service.update({ unsplashKey: 'unsplash-test', voicePreviewVoice: 'en-GB-SoniaNeural' });
      const settings = await service.get();
      expect(settings.unsplashKey).toBe('unsplash-test');
      expect(settings.voicePreviewVoice).toBe('en-GB-SoniaNeural');
      expect(settings.pixabayKey).toBe('');
      expect(settings.pexelsKey).toBe('');
    });
  });
});
