import { Router } from 'express';
import { TemplateService } from '../../application/services/TemplateService.js';

const router: Router = Router();
const templateService = new TemplateService();

router.get('/templates/markdown', (_req, res) => {
  res.json({ template: templateService.getMarkdownTemplate() });
});

export { router as templateRoutes };