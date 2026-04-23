import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createContract,
  createContractCollaborationInvite,
  deleteContract,
  getContractDocumentDetailsView,
  listContractCollaborationsView,
  listContractTenantsView,
  listContracts,
  updateContract,
} from '../controllers/contractsController.js';

const router = Router();
router.use(requireAuth);
router.get('/', listContracts);
router.get('/:id/document-details', getContractDocumentDetailsView);
router.get('/:id/tenants', listContractTenantsView);
router.get('/:id/collaborations', listContractCollaborationsView);
router.post('/:id/collaborations', createContractCollaborationInvite);
router.post('/', createContract);
router.patch('/:id', updateContract);
router.delete('/:id', deleteContract);

export { router as contractsRouter };
