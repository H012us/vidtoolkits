import { Router } from 'express';
import { SettingsController } from '../controllers/SettingsController.js';

const router: Router = Router();
const ctrl = new SettingsController();

router.get('/settings', (req, res, next) => ctrl.get(req, res, next));
router.patch('/settings', (req, res, next) => ctrl.update(req, res, next));

export { router as settingsRoutes };