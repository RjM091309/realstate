import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createContractSpecialRequest,
  listContractSpecialRequests,
} from '../controllers/specialRequestsController.js';

const router = Router();
router.use(requireAuth);

router.get('/contracts/:contractId', listContractSpecialRequests);
router.post('/contracts/:contractId', createContractSpecialRequest);

export { router as specialRequestsRouter };

