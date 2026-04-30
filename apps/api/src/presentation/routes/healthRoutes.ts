import { Router } from 'express';
import { getEnv } from '../../infrastructure/config/EnvConfig.js';
import { container } from '../../infrastructure/container.js';
import type { HealthCheckService } from '../../application/services/HealthCheckService.js';

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

router.get('/health/detailed', async (_req, res) => {
  const svc = container.get<HealthCheckService>('HealthCheckService');
  const report = await svc.check();
  res.json(report);
});

router.post('/health/test/:provider', async (req, res, next) => {
  try {
    const svc = container.get<HealthCheckService>('HealthCheckService');
    const result = await svc.testProvider(req.params.provider);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export { router as healthRoutes };