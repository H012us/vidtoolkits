import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { RenderService } from '../../application/services/RenderService.js';
import { RenderJobStore } from '../../infrastructure/persistence/RenderJobStore.js';
import { RenderJobEntity } from '../../domain/entities/RenderJobEntity.js';
import { container } from '../../infrastructure/container.js';

vi.mock('../../application/services/PipelineOrchestrator.js', () => ({
  PipelineOrchestrator: vi.fn(),
}));

describe('RenderService — job progress persistence (A.4)', () => {
  let tempDir: string;
  let jobStore: RenderJobStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtoolkits-rs-test-'));
    const jobsDir = path.join(tempDir, 'jobs');
    await fs.mkdir(jobsDir, { recursive: true });
    jobStore = new RenderJobStore(jobsDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('A.4.1 sendProgress callback updates job entity currentStep and progress', async () => {
    // Register a mock orchestrator so the service can instantiate
    container.register('HealthCheckService', {
      check: vi.fn().mockResolvedValue({
        voicebox: { status: 'available', message: null },
        edgeTts: { status: 'available' },
        imageProviders: [{ name: 'pixabay', configured: true, available: true }],
        binaries: { ffmpeg: { available: true }, ffprobe: { available: true } },
        remotion: { available: true },
      }),
      testProvider: vi.fn(),
    } as any);

    // Create service with a mock store
    const service = Object.create(RenderService.prototype);
    (service as any).jobStore = jobStore;
    (service as any).projectService = { getProject: vi.fn() };
    (service as any).activeJobs = new Map();

    // Manually register orchestrator on container (used by get orchestrator())
    const mockOrchestrator = {
      run: vi.fn().mockResolvedValue({
        projectId: 'test',
        outputPath: '/tmp/out.mp4',
        success: true,
        stepsCompleted: [],
        errors: [],
        totalDurationMs: 1000,
      }),
    };
    container.register('PipelineOrchestrator', mockOrchestrator as any);

    const projectId = '00000000-0000-0000-0000-000000000001';
    const job = new RenderJobEntity(projectId);
    job.start();
    await jobStore.save(job.toJSON());

    // Simulate sendProgress callback directly
    const step = 'FETCH_IMAGES';
    const progress = 50;
    await service.persistJobProgress(job.id, step, progress);

    const saved = await jobStore.get(job.id);
    expect(saved!.currentStep).toBe(step);
    expect(saved!.progress).toBe(progress);
  });

  it('A.4.2 persistJobProgress saves to disk via jobStore.save()', async () => {
    const service = Object.create(RenderService.prototype);
    (service as any).jobStore = jobStore;
    (service as any).projectService = { getProject: vi.fn() };
    (service as any).activeJobs = new Map();

    container.register('PipelineOrchestrator', { run: vi.fn() } as any);
    container.register('HealthCheckService', {
      check: vi.fn().mockResolvedValue({
        voicebox: { status: 'available', message: null },
        edgeTts: { status: 'available' },
        imageProviders: [{ name: 'pixabay', configured: true, available: true }],
        binaries: { ffmpeg: { available: true }, ffprobe: { available: true } },
        remotion: { available: true },
      }),
    } as any);

    const projectId = '00000000-0000-0000-0000-000000000002';
    const job = new RenderJobEntity(projectId);
    job.start();
    await jobStore.save(job.toJSON());

    const saveSpy = vi.spyOn(jobStore, 'save');

    await service.persistJobProgress(job.id, 'GENERATE_TTS', 75);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const [savedData] = saveSpy.mock.calls[0];
    expect(savedData.currentStep).toBe('GENERATE_TTS');
    expect(savedData.progress).toBe(75);
  });
});
