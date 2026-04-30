import { Router } from 'express';
import { RenderController } from '../controllers/RenderController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { renderLimiter } from '../middleware/rateLimiter.js';
import { z } from 'zod';

const router: Router = Router();
const controller = new RenderController();

router.post('/:id/start', renderLimiter, validateRequest(z.object({
  params: z.object({ id: z.string().uuid() }),
})), controller.start.bind(controller));
router.get('/:id/status', controller.status.bind(controller));
router.get('/:id/download', validateRequest(z.object({
  params: z.object({ id: z.string().uuid() }),
})), controller.download.bind(controller));
router.delete('/:id', validateRequest(z.object({
  params: z.object({ id: z.string().uuid() }),
})), controller.cancel.bind(controller));

export { router as renderRoutes };