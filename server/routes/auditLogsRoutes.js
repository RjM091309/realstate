import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { listAuditLogs } from '../controllers/auditLogsController.js';

const router = Router();
router.use(requireAuth);

router.get('/', listAuditLogs);

export { router as auditLogsRouter };

