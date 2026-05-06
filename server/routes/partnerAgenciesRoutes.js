import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createPartnerAgency,
  deletePartnerAgency,
  listPartnerAgencies,
  listPartnerAgencyCollaborations,
  uploadPartnerAgencyKycDocument,
  updatePartnerAgency,
} from '../controllers/partnerAgenciesController.js';
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
router.get('/', listPartnerAgencies);
router.get('/:id/collaborations', listPartnerAgencyCollaborations);
router.post('/', createPartnerAgency);
router.post('/:id/kyc-document', upload.single('file'), uploadPartnerAgencyKycDocument);
router.patch('/:id', updatePartnerAgency);
router.delete('/:id', deletePartnerAgency);

export { router as partnerAgenciesRouter };
