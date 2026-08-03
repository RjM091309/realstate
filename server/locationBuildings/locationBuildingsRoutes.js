import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createBuilding,
  deleteBuilding,
  listBuildings,
  updateBuilding,
} from './locationBuildingsController.js';

const router = Router();
router.use(requireAuth);

router.get('/', listBuildings);
router.post('/', createBuilding);
router.patch('/:id', updateBuilding);
router.delete('/:id', deleteBuilding);
/** Soft-delete by location + building name (no id). */
router.post('/soft-delete', deleteBuilding);

export { router as locationBuildingsRouter };
