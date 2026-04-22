import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createBlacklist,
  listBlacklist,
  removeBrokerFromBlacklist,
  removeTenantFromBlacklist,
} from '../controllers/blacklistController.js';

const router = Router();
router.use(requireAuth);
router.get('/', listBlacklist);
router.post('/', createBlacklist);
router.delete('/tenant/:tenantId', removeTenantFromBlacklist);
router.delete('/broker/:partnerAgencyId', removeBrokerFromBlacklist);

export { router as blacklistRouter };
