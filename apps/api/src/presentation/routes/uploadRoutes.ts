import { Router } from 'express';
import { UploadController } from '../controllers/UploadController.js';
import { uploadMiddleware } from '../../infrastructure/multer.js';

const router: Router = Router();
const controller = new UploadController();

router.post('/', uploadMiddleware.single('file'), controller.upload.bind(controller));

export { router as uploadRoutes };