import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { createContractInvoice, getInvoice, listContractInvoices, patchInvoice } from '../controllers/invoicesController.js';

const router = Router();
router.use(requireAuth);

router.get('/contracts/:contractId', listContractInvoices);
router.post('/contracts/:contractId', createContractInvoice);
router.get('/:id', getInvoice);
router.patch('/:id', patchInvoice);

export { router as invoicesRouter };

