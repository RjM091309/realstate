import { Router } from 'express';
import { listPublicAgents, listPublicListings } from '../controllers/publicController.js';

const router = Router();

router.get('/listings', listPublicListings);
router.get('/agents', listPublicAgents);

export { router as publicRouter };
