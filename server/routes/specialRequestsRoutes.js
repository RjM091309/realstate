import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createContractSpecialRequest,
  listBranchSpecialRequests,
  listContractSpecialRequests,
  patchSpecialRequestStatus,
} from '../controllers/specialRequestsController.js';

const router = Router();
router.use(requireAuth);

router.get('/', listBranchSpecialRequests);
router.patch('/:id', patchSpecialRequestStatus);
router.get('/contracts/:contractId', listContractSpecialRequests);
router.post('/contracts/:contractId', createContractSpecialRequest);

export { router as specialRequestsRouter };

