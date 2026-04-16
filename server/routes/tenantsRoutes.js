import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createTenant,
  deleteTenant,
  listTenants,
  updateTenant,
} from '../controllers/tenantsController.js';

const router = Router();
router.use(requireAuth);
router.get('/', listTenants);
router.post('/', createTenant);
router.patch('/:id', updateTenant);
router.delete('/:id', deleteTenant);

export { router as tenantsRouter };
