import type { Express } from 'express';
import { healthRoutes } from './healthRoutes.js';
import { projectRoutes } from './projectRoutes.js';
import { uploadRoutes } from './uploadRoutes.js';
import { renderRoutes } from './renderRoutes.js';

export function registerRoutes(app: Express): void {
  app.use('/api', healthRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/render', renderRoutes);
}