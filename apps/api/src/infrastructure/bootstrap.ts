import { container } from './container.js';
import { CONFIG } from './config/index.js';
import { sseManager } from '../presentation/SSE/SSEManager.js';

// Services
import { ProjectService } from '../application/services/ProjectService.js';
import { RenderService } from '../application/services/RenderService.js';
import { UploadService } from '../application/services/UploadService.js';
import { PipelineOrchestrator } from '../application/services/PipelineOrchestrator.js';
import { MarkdownParserService } from '../application/services/MarkdownParserService.js';
import { SettingsService } from '../application/services/SettingsService.js';
import { HealthCheckService } from '../application/services/HealthCheckService.js';
import { MediaProviderRegistry } from './media-providers/MediaProviderRegistry.js';
import { CacheManager } from './cache/CacheManager.js';

// TTS Engines
import { VoiceboxTTSEngine } from './tts-engines/VoiceboxTTSEngine.js';
import { EdgeTTSEngine } from './tts-engines/EdgeTTSEngine.js';

// Media Providers
import { PixabayProvider } from './media-providers/PixabayProvider.js';
import { PexelsProvider } from './media-providers/PexelsProvider.js';
import { UnsplashProvider } from './media-providers/UnsplashProvider.js';

export function bootstrap(): void {
  // SSE Manager
  container.register('SSEManager', sseManager);

  // Cache
  const cacheManager = new CacheManager(CONFIG.paths.cacheDir, CONFIG.performance.cacheDiskMaxMB);
  container.register('CacheManager', cacheManager);

  // TTS Engines (priority: lower = tried first)
  const ttsEngines = [
    new VoiceboxTTSEngine(CONFIG.voiceboxUrl),
    new EdgeTTSEngine(),
  ].sort((a, b) => a.priority - b.priority);
  container.register('ITTSEngine[]', ttsEngines);

  // Media Providers (priority: lower = tried first)
  const mediaProviders = [
    new PixabayProvider(CONFIG.imageProviders.pixabayKey),
    new PexelsProvider(CONFIG.imageProviders.pexelsKey),
    new UnsplashProvider(CONFIG.imageProviders.unsplashKey),
  ].sort((a, b) => a.priority - b.priority);
  container.register('IMediaProvider[]', mediaProviders);

  // Media Registry
  const registry = new MediaProviderRegistry(mediaProviders, cacheManager);
  container.register('MediaProviderRegistry', registry);

  // Core services
  container.register('MarkdownParserService', new MarkdownParserService());
  container.register('CacheManager', cacheManager);
  container.register('MediaProviderRegistry', registry);

  // Pipeline Orchestrator
  const orchestrator = new PipelineOrchestrator(
    container.get<MediaProviderRegistry>('MediaProviderRegistry'),
    container.get<ReturnType<typeof container.getTTSEngines>>('ITTSEngine[]'),
    CONFIG
  );
  container.register('PipelineOrchestrator', orchestrator);

  // Application services
  container.register('ProjectService', new ProjectService());
  container.register('RenderService', new RenderService());
  container.register('UploadService', new UploadService());
  container.register('SettingsService', new SettingsService(CONFIG.paths.dataDir));
  container.register('HealthCheckService', new HealthCheckService());
}