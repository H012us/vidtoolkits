import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { CONFIG } from './infrastructure/config/index.js';
import { logger } from './infrastructure/logger.js';
import { registerRoutes } from './presentation/routes/index.js';
import { errorHandler } from './presentation/middleware/errorHandler.js';
import { ensureDirectories } from './infrastructure/fsUtils.js';
import { registerShutdown } from './infrastructure/shutdown.js';
import { bootstrap as initContainer } from './infrastructure/bootstrap.js';

const app: ReturnType<typeof express> = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS — whitelist only the frontend
app.use(cors({
  origin: CONFIG.frontendUrl,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check — before auth/rate-limit
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    pid: process.pid,
  });
});

// Register API routes
registerRoutes(app);

// Error handler
app.use(errorHandler);

// Bootstrap
async function bootstrap() {
  await ensureDirectories();
  initContainer();
  registerShutdown();

  app.listen(CONFIG.port, () => {
    logger.info({ port: CONFIG.port, env: CONFIG.nodeEnv }, 'vidtoolkits-api started');
    logger.info({
      remotionConcurrency: CONFIG.performance.remotionConcurrency,
      maxConcurrentImages: CONFIG.performance.maxConcurrentImages,
      maxConcurrentTTS: CONFIG.performance.maxConcurrentTTS,
    }, 'Performance config');
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

export { app };