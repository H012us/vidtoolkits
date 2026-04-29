import { MediaAsset } from '../types/VideoProject.js';

export interface RenderJob {
  id: string;
  projectId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep: PipelineStepName | null;
  startedAt: string;
  completedAt: string | null;
  outputPath: string | null;
  fileSize: number | null;
  error: string | null;
}

export interface IPipelineStep {
  readonly name: PipelineStepName;
  readonly priority: number;

  execute(ctx: PipelineContext): Promise<PipelineContext>;
  validate(ctx: PipelineContext): ValidationResult;
  canSkip(ctx: PipelineContext): boolean;
}

export type PipelineStepName =
  | 'PARSE_MARKDOWN'
  | 'FETCH_IMAGES'
  | 'GENERATE_TTS'
  | 'MEASURE_DURATIONS'
  | 'ASSEMBLE_COMPOSITION'
  | 'RENDER_VIDEO'
  | 'POST_PROCESS'
  | 'DELIVER_RESULT';

export interface PipelineContext {
  projectId: string;
  rawMarkdown: string;
  parsedProject: ParsedProject | null;
  partStates: PartState[];
  currentStep: PipelineStepName | null;
  stepStatuses: Map<PipelineStepName, StepStatus>;
  progress: number;
  errors: PipelineError[];
  outputPath: string | null;
  startedAt: Date;
  config: PipelineConfig;
}

export interface ParsedProject {
  title: string;
  style: string;
  voiceName: string;
  durationPerPart: number;
  parts: ParsedPart[];
}

export interface ParsedPart {
  index: number;
  title: string;
  script: string;
  keywords: string[];
}

export interface PartState {
  partIndex: number;
  title: string;
  script: string;
  keywords: string[];
  images: MediaAsset[];
  ttsPath: string | null;
  durationSeconds: number | null;
  status: StepStatus;
}

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineError {
  step: PipelineStepName;
  message: string;
  recoverable: boolean;
  timestamp: Date;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PipelineConfig {
  outputDir: string;
  tempDir: string;
  maxConcurrentImages: number;
  maxConcurrentTTS: number;
  remotionConcurrency: number;
  nodeMaxOldSpaceMB: number;
  cacheDiskMaxMB: number;
}

export interface TTSResult {
  path: string;
  durationSeconds: number;
  voice: string;
  engine: string;
}

export interface PipelineResult {
  projectId: string;
  outputPath: string | null;
  success: boolean;
  stepsCompleted: PipelineStepName[];
  errors: PipelineError[];
  totalDurationMs: number;
}