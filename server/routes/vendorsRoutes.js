import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createVendor,
  deleteVendorHandler,
  listVendors,
  updateVendorHandler,
} from '../controllers/vendorsController.js';

const router = Router();
router.use(requireAuth);

router.get('/', listVendors);
router.post('/', createVendor);
router.patch('/:id', updateVendorHandler);
router.delete('/:id', deleteVendorHandler);

export { router as vendorsRouter };
