import type { IMediaProvider } from '@vidtoolkits/shared';
import type { ITTSEngine } from '@vidtoolkits/shared';
import type { SSEManager } from '../presentation/SSE/SSEManager.js';
import { sseManager } from '../presentation/SSE/SSEManager.js';
import { CONFIG } from './config/index.js';

// Service implementations — will be populated as services are created
const registry = new Map<string, unknown>();

export const container = {
  register<T>(token: string, instance: T): void {
    registry.set(token, instance);
  },

  get<T>(token: string): T {
    const instance = registry.get(token);
    if (!instance) {
      throw new Error(`Service not registered: ${token}`);
    }
    return instance as T;
  },

  has(token: string): boolean {
    return registry.has(token);
  },

  getMediaProviders(): IMediaProvider[] {
    return container.get<IMediaProvider[]>('IMediaProvider[]');
  },

  getTTSEngines(): ITTSEngine[] {
    return container.get<ITTSEngine[]>('ITTSEngine[]');
  },

  getSSEManager(): SSEManager {
    return sseManager;
  },

  getConfig() {
    return CONFIG;
  },
};

export type Container = typeof container;