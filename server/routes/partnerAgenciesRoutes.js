import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createPartnerAgency,
  deletePartnerAgency,
  listPartnerAgencies,
  updatePartnerAgency,
} from '../controllers/partnerAgenciesController.js';

const router = Router();
router.use(requireAuth);
router.get('/', listPartnerAgencies);
router.post('/', createPartnerAgency);
router.patch('/:id', updatePartnerAgency);
router.delete('/:id', deletePartnerAgency);

export { router as partnerAgenciesRouter };
