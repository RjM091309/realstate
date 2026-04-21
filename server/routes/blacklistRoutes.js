import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { createBlacklist, listBlacklist } from '../controllers/blacklistController.js';

const router = Router();
router.use(requireAuth);
router.get('/', listBlacklist);
router.post('/', createBlacklist);

export { router as blacklistRouter };
