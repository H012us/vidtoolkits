import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorHandler } from '../presentation/middleware/errorHandler.js';
import { healthRoutes } from '../presentation/routes/healthRoutes.js';
import { projectRoutes } from '../presentation/routes/projectRoutes.js';
import { uploadRoutes } from '../presentation/routes/uploadRoutes.js';
import { renderRoutes } from '../presentation/routes/renderRoutes.js';

export function createTestApp() {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use('/api', healthRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/render', renderRoutes);

  app.use(errorHandler);
  return app;
}
