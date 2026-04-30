import { Router } from 'express';
import { ProjectController } from '../controllers/ProjectController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';

const router: Router = Router();
const controller = new ProjectController();

router.get('/', controller.list.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.patch('/:id', validateRequest(z.object({
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    voiceName: z.string().optional(),
    durationPerPart: z.number().int().min(1).max(60).optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
})), controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));
router.post('/from-template', controller.fromTemplate.bind(controller));

export { router as projectRoutes };