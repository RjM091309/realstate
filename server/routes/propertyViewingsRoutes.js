import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createViewing,
  deleteViewing,
  listBranchViewings,
  updateViewing,
} from '../controllers/propertyViewingsController.js';

const router = Router();
router.use(requireAuth);

router.get('/', listBranchViewings);
router.post('/', createViewing);
router.patch('/:id', updateViewing);
router.delete('/:id', deleteViewing);

export { router as propertyViewingsRouter };
