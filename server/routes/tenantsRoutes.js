import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createTenant,
  deleteTenant,
  getTenant,
  listTenantPortalDocuments,
  listTenants,
  streamTenantPortalArtifact,
  updateTenant,
  uploadTenantKycDocument,
} from '../controllers/tenantsController.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(process.cwd(), 'server', 'uploads', 'kyc');
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const router = Router();
router.use(requireAuth);
router.get('/', listTenants);
router.get('/:id/portal-documents', listTenantPortalDocuments);
router.get('/:id/portal-artifacts/:slug', streamTenantPortalArtifact);
router.get('/:id', getTenant);
router.post('/', createTenant);
router.patch('/:id', updateTenant);
router.post('/:id/kyc-document', upload.single('file'), uploadTenantKycDocument);
router.delete('/:id', deleteTenant);

export { router as tenantsRouter };
