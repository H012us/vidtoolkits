import { TTSResult } from './IPipelineStep.js';

export interface ITTSEngine {
  readonly name: string;
  readonly priority: number;

  generate(text: string, outputPath: string, voice?: string): Promise<TTSResult>;
  getAvailableVoices(): Promise<Voice[]>;
  isAvailable(): Promise<boolean>;
}

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  engine: string;
}

export const DEFAULT_VOICE = 'en-US-AriaNeural';