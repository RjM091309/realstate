import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createDocumentTemplate,
  createContractRepositoryDocument,
  listContractRepositoryDocuments,
  listDocumentTemplates,
} from '../controllers/documentsController.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(process.cwd(), 'server', 'uploads', 'repository');
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // ignore
      }
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const templateUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(process.cwd(), 'server', 'uploads', 'templates');
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // ignore
      }
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Templates
router.get('/templates', listDocumentTemplates);
router.post('/templates', templateUpload.single('file'), createDocumentTemplate);

// Repository documents
router.get('/contracts/:contractId/repository', listContractRepositoryDocuments);
router.post('/contracts/:contractId/repository', upload.single('file'), createContractRepositoryDocument);

export { router as documentsRouter };

