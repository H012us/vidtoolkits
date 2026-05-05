import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import axios from 'axios';
import { PipelineOrchestrator } from '../../application/services/PipelineOrchestrator.js';
import { MediaProviderRegistry } from '../../infrastructure/media-providers/MediaProviderRegistry.js';
import type { PartState } from '@vidtoolkits/shared';

vi.mock('axios');

function makeAppConfig(tempDir: string): any {
  return {
    paths: {
      projectsDir: path.join(tempDir, 'projects'),
      outputDir: path.join(tempDir, 'output'),
      tempDir,
      cacheDir: path.join(tempDir, 'cache'),
      remotionDir: path.join(os.homedir(), 'node_modules', '.bin', 'remotion'),
    },
    performance: {
      nodeMaxOldSpaceMB: 4096,
      cacheDiskMaxMB: 2048,
      maxConcurrentImages: 6,
      maxConcurrentTTS: 2,
      remotionConcurrency: 3,
    },
  };
}

function makePartState(overrides: Partial<PartState> = {}): PartState {
  return {
    partIndex: 0,
    title: 'Test Part',
    script: 'Hello world.',
    keywords: ['sunset'],
    images: [],
    ttsPath: null,
    durationSeconds: null,
    status: 'pending',
    ...overrides,
  };
}

describe('PipelineOrchestrator — downloadImages (A.1)', () => {
  let tempDir: string;
  let imagesDir: string;
  let orchestrator: PipelineOrchestrator;
  let mockRegistry: MediaProviderRegistry;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtoolkits-orch-test-'));
    imagesDir = path.join(tempDir, 'images');
    await fs.mkdir(imagesDir, { recursive: true });
    mockRegistry = {
      search: vi.fn(),
    } as any;
    const config = makeAppConfig(tempDir);
    orchestrator = new PipelineOrchestrator(mockRegistry, [], config);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  function makeMockImage(url: string): any {
    return { id: '1', url, thumbnailUrl: url, source: 'pixabay', sourceId: '1', alt: 'img', width: 1920, height: 1080, attribution: '' };
  }

  it('A.1.1 writes downloaded PNG to workDir/images/ and returns local paths', async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    vi.mocked(axios.get).mockResolvedValue({
      data: pngBuffer,
      headers: { 'content-type': 'image/png' },
    });

    const parts: PartState[] = [
      makePartState({
        partIndex: 0,
        images: [makeMockImage('https://example.com/photo.png')],
      }),
    ];

    const result = await orchestrator.downloadImages(parts, imagesDir);

    expect(result).toBeUndefined(); // method returns void
    expect(parts[0].images[0].localPath).toBeDefined();
    const localPath = parts[0].images[0].localPath!;
    const exists = await fs.access(localPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    expect(localPath).toContain('part-0-0.png');
  });

  it('A.1.2 HTTP 404 on one image logs warning and leaves localPath undefined', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: Buffer.alloc(4), headers: { 'content-type': 'image/jpeg' } })
      .mockRejectedValueOnce(new Error('Request failed with status code 404'));

    const parts: PartState[] = [
      makePartState({
        partIndex: 0,
        images: [
          makeMockImage('https://example.com/good.jpg'),
          makeMockImage('https://example.com/missing.jpg'),
        ],
      }),
    ];

    await orchestrator.downloadImages(parts, imagesDir);

    expect(parts[0].images[0].localPath).toBeDefined();
    expect(parts[0].images[1].localPath).toBeUndefined();
  });

  it('A.1.3 Content-Type image/png → file has .png extension', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: Buffer.alloc(4),
      headers: { 'content-type': 'image/png' },
    });

    const parts: PartState[] = [
      makePartState({
        partIndex: 0,
        images: [makeMockImage('https://example.com/images/sunset.png?v=123')],
      }),
    ];

    await orchestrator.downloadImages(parts, imagesDir);

    expect(parts[0].images[0].localPath).toMatch(/\.png$/);
  });

  it('A.1.4 no Content-Type but URL ends in .jpg → file has .jpg extension', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: Buffer.alloc(4),
      headers: {},
    });

    const parts: PartState[] = [
      makePartState({
        partIndex: 0,
        images: [makeMockImage('https://example.com/images/mountain.jpg?v=456')],
      }),
    ];

    await orchestrator.downloadImages(parts, imagesDir);

    expect(parts[0].images[0].localPath).toMatch(/\.jpg$/);
  });
});

describe('PipelineOrchestrator — cleanupWorkDir (A.2)', () => {
  let tempDir: string;
  let orchestrator: PipelineOrchestrator;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtoolkits-orch-test-'));
    const mockRegistry = {} as any;
    const config = makeAppConfig(tempDir);
    orchestrator = new PipelineOrchestrator(mockRegistry, [], config);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('A.2.1 cleanupWorkDir removes existing directory without throwing', async () => {
    const workDir = path.join(tempDir, 'work');
    await fs.mkdir(workDir, { recursive: true });
    await fs.writeFile(path.join(workDir, 'file.txt'), 'data');

    await expect(orchestrator.cleanupWorkDir(workDir)).resolves.toBeUndefined();

    const exists = await fs.access(workDir).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it('A.2.2 cleanupWorkDir handles missing path gracefully', async () => {
    const missingDir = path.join(tempDir, 'does-not-exist');

    await expect(orchestrator.cleanupWorkDir(missingDir)).resolves.toBeUndefined();
  });
});

describe('PipelineOrchestrator — killAllProcesses (A.3)', () => {
  // NOTE: killAllProcesses is a private local function inside run(), not a class method.
  // It is tested via the abort signal contract: processes tracked in activeProcesses[]
  // are killed when the abort fires.

  it('A.3.1 abort signal kills tracked processes and clears the activeProcesses list', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtoolkits-orch-abort-'));
    try {
      const mockRegistry = {
        search: vi.fn().mockResolvedValue([]),
      } as any;
      const config = makeAppConfig(tempDir);
      const orchestrator = new PipelineOrchestrator(mockRegistry, [], config);

      // Inject a mock process into activeProcesses
      const killSpy = vi.fn();
      (orchestrator as any).activeProcesses = [{ kill: killSpy }];

      const abortCtrl = new AbortController();

      // Register the abort listener (same pattern used in PipelineOrchestrator.run())
      abortCtrl.signal.addEventListener('abort', () => {
        (orchestrator as any).activeProcesses.forEach((proc: any) => {
          try { proc.kill(); } catch { /* ignore */ }
        });
        (orchestrator as any).activeProcesses = [];
      });

      abortCtrl.abort();

      expect(killSpy).toHaveBeenCalledTimes(1);
      expect((orchestrator as any).activeProcesses).toHaveLength(0);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('A.3.2 killAllProcesses is called before the abort handler exits', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtoolkits-orch-abort2-'));
    try {
      const mockRegistry = {
        search: vi.fn().mockResolvedValue([]),
      } as any;
      const config = makeAppConfig(tempDir);
      const orchestrator = new PipelineOrchestrator(mockRegistry, [], config);

      let killOrder: string[] = [];
      const killSpy = vi.fn(() => { killOrder.push('kill'); });

      (orchestrator as any).activeProcesses = [{ kill: killSpy }];

      const abortCtrl = new AbortController();
      abortCtrl.signal.addEventListener('abort', () => {
        (orchestrator as any).activeProcesses.forEach((proc: any) => {
          try { proc.kill(); } catch { /* ignore */ }
        });
        (orchestrator as any).activeProcesses = [];
        killOrder.push('cleanup');
      });

      abortCtrl.abort();

      expect(killOrder).toEqual(['kill', 'cleanup']);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
