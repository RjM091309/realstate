import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createPayment,
  deletePayment,
  listPayments,
  updatePayment,
} from '../controllers/paymentsController.js';

const router = Router();
router.use(requireAuth);
router.get('/', listPayments);
router.post('/', createPayment);
router.patch('/:id', updatePayment);
router.delete('/:id', deletePayment);

export { router as paymentsRouter };
