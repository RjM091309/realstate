import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { createUnit, deleteUnit, listUnits, updateUnit } from '../controllers/unitsController.js';

const router = Router();
router.use(requireAuth);

router.get('/', listUnits);
router.post('/', createUnit);
router.patch('/:id', updateUnit);
router.delete('/:id', deleteUnit);

export { router as unitsRouter };
