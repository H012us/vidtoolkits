import type { VideoProject, RenderJob, MediaAsset } from '@vidtoolkits/shared';

export function makeVideoProject(overrides: Partial<VideoProject> = {}): VideoProject {
  const now = new Date().toISOString();
  return {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Test Video',
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

export function makePart(overrides: Partial<VideoProject['parts'][0]> = {}): VideoProject['parts'][0] {
  return {
    partIndex: 0,
    title: 'Test Part',
    script: 'Hello world.',
    keywords: ['sunset', 'ocean'],
    images: [],
    ttsPath: null,
    durationSeconds: null,
    status: 'pending',
    ...overrides,
  };
}

export function makeRenderJob(overrides: Partial<RenderJob> = {}): RenderJob {
  const now = new Date().toISOString();
  return {
    id: '00000000-0000-0000-0000-000000000002',
    projectId: '00000000-0000-0000-0000-000000000001',
    status: 'queued',
    progress: 0,
    currentStep: null,
    startedAt: now,
    completedAt: null,
    outputPath: null,
    fileSize: null,
    error: null,
    ...overrides,
  };
}

export function makeMediaAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: '00000000-0000-0000-0000-000000000003',
    url: 'https://example.com/image.jpg',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    source: 'pixabay',
    sourceId: '12345',
    alt: 'A beautiful sunset',
    width: 1920,
    height: 1080,
    attribution: 'Photographer',
    ...overrides,
  };
}

export function makeMockResponse(): any {
  const chunks: string[] = [];
  return {
    write: vi.fn((data: string) => {
      chunks.push(data);
      return true;
    }),
    end: vi.fn(),
    flushHeaders: vi.fn(),
    setHeader: vi.fn(),
    getChunks: () => chunks,
  };
}
