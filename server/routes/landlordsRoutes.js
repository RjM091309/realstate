import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createLandlord,
  deleteLandlord,
  getLandlord,
  getLandlordDetail,
  listLandlords,
  updateLandlord,
  uploadLandlordDocument,
  uploadLandlordKycFile,
} from '../controllers/landlordsController.js';

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
      const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
      cb(null, `landlord-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
});

const router = Router();
router.use(requireAuth);

router.get('/', listLandlords);
router.get('/:id/detail', getLandlordDetail);
router.get('/:id', getLandlord);
router.post('/', createLandlord);
router.patch('/:id', updateLandlord);
router.delete('/:id', deleteLandlord);
router.post('/:id/kyc/:field', upload.single('file'), uploadLandlordKycFile);
router.post('/:id/documents', upload.single('file'), uploadLandlordDocument);

export { router as landlordsRouter };
