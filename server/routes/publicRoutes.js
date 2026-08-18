import { Router } from 'express';
import { listPublicListings } from '../controllers/publicController.js';

const router = Router();

router.get('/listings', listPublicListings);

export { router as publicRouter };
