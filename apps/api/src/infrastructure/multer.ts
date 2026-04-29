import multer from 'multer';
import { CONFIG } from '../infrastructure/config/index.js';

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CONFIG.limits.maxMdSizeKB * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/markdown' || file.originalname.endsWith('.md') || file.originalname.endsWith('.markdown')) {
      cb(null, true);
    } else {
      cb(new Error('Only .md or .markdown files are accepted'));
    }
  },
});