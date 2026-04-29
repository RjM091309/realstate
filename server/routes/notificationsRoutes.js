import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { listNotifications, markAllRead, markOneRead } from '../controllers/notificationsController.js';

const router = Router();
router.use(requireAuth);
router.get('/', listNotifications);
router.post('/mark-all-read', markAllRead);
router.post('/:key/read', markOneRead);

export { router as notificationsRouter };

