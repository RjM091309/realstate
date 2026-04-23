import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createLandlord,
  deleteLandlord,
  getLandlord,
  listLandlords,
  updateLandlord,
} from '../controllers/landlordsController.js';

const router = Router();
router.use(requireAuth);

router.get('/', listLandlords);
router.get('/:id', getLandlord);
router.post('/', createLandlord);
router.patch('/:id', updateLandlord);
router.delete('/:id', deleteLandlord);

export { router as landlordsRouter };

