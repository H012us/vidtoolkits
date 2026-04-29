import { Router } from 'express';
import { getEnv } from '../../infrastructure/config/EnvConfig.js';

const router: Router = Router();

router.get('/health', (_req, res) => {
  const env = getEnv();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptime: process.uptime(),
    env: env.NODE_ENV,
  });
});

export { router as healthRoutes };