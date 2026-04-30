import { PipelineStepName } from '../interfaces/IPipelineStep.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

export const SETTINGS_FILE_PATH = path.join(PROJECT_ROOT, 'data', 'settings.json');

export const PIPELINE_STEPS_ORDER: PipelineStepName[] = [
  'PARSE_MARKDOWN',
  'FETCH_IMAGES',
  'GENERATE_TTS',
  'MEASURE_DURATIONS',
  'ASSEMBLE_COMPOSITION',
  'RENDER_VIDEO',
  'POST_PROCESS',
  'DELIVER_RESULT',
];

export const DEFAULT_MAX_CONCURRENT_IMAGES = 6;
export const DEFAULT_MAX_CONCURRENT_TTS = 2;
export const DEFAULT_REMOTION_CONCURRENCY = 3;
export const DEFAULT_NODE_MAX_OLD_SPACE_MB = 4096;
export const DEFAULT_CACHE_DISK_MAX_MB = 2048;
export const DEFAULT_MAX_MD_SIZE_KB = 500;

export const VOICEBOX_BASE_URL = 'http://127.0.0.1:17493';
export const VOICEBOX_GENERATE_ENDPOINT = '/generate';
export const VOICEBOX_PROFILES_ENDPOINT = '/profiles';

export const SUPPORTED_VIDEO_STYLES = ['cinematic', 'minimal', 'bold'] as const;
export const DEFAULT_VIDEO_STYLE = 'cinematic';
export const DEFAULT_DURATION_PER_PART = 8;