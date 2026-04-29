import { logger } from './logger.js';

export function registerShutdown(): void {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGBREAK'];

  for (const sig of signals) {
    process.on(sig, async (signal) => {
      logger.info({ signal }, 'Received shutdown signal, exiting gracefully');
      process.exit(0);
    });
  }

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
}