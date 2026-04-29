import * as pinoDefault from 'pino';
import { CONFIG } from './config/index.js';

// pino v8 is CJS but its .d.ts uses a namespace, which breaks ESM interop under NodeNext.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pino = (pinoDefault as any) ?? pinoDefault;

const isDev = CONFIG.nodeEnv === 'development';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    pid: process.pid,
  },
});
