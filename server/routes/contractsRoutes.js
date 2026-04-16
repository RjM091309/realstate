import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createContract,
  deleteContract,
  listContracts,
  updateContract,
} from '../controllers/contractsController.js';

const router = Router();
router.use(requireAuth);
router.get('/', listContracts);
router.post('/', createContract);
router.patch('/:id', updateContract);
router.delete('/:id', deleteContract);

export { router as contractsRouter };
