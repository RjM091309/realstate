import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createAreaHandler,
  createBrgyHandler,
  createCityHandler,
  deleteBrgyHandler,
  deleteCityHandler,
  listAreasHandler,
  listBrgysHandler,
  listCitiesHandler,
  updateBrgyHandler,
  updateCityHandler,
} from './locationsController.js';

const router = Router();
router.use(requireAuth);

router.get('/cities', listCitiesHandler);
router.post('/cities', createCityHandler);
router.patch('/cities/:cityId', updateCityHandler);
router.delete('/cities/:cityId', deleteCityHandler);

router.get('/brgys', listBrgysHandler);
router.post('/brgys', createBrgyHandler);
router.patch('/brgys/:brgyId', updateBrgyHandler);
router.delete('/brgys/:brgyId', deleteBrgyHandler);

router.get('/areas', listAreasHandler);
router.post('/areas', createAreaHandler);

export { router as locationsRouter };
