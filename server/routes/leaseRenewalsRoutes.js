import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  getContractRenewal,
  getDraftPdf,
  getStatementPdf,
  patchRenewal,
  postActivateRenewal,
  postDeclineRenewal,
  postManagerApproval,
  postRefreshBalance,
  postSaveDraft,
  postTenantSignature,
} from '../controllers/leaseRenewalsController.js';

export const leaseRenewalsRouter = Router();

leaseRenewalsRouter.use(requireAuth);

leaseRenewalsRouter.get('/contracts/:contractId', getContractRenewal);
leaseRenewalsRouter.patch('/:renewalId', patchRenewal);
leaseRenewalsRouter.post('/:renewalId/save-draft', postSaveDraft);
leaseRenewalsRouter.post('/:renewalId/refresh-balance', postRefreshBalance);
leaseRenewalsRouter.get('/:renewalId/draft.pdf', getDraftPdf);
leaseRenewalsRouter.get('/:renewalId/statement.pdf', getStatementPdf);
leaseRenewalsRouter.post('/:renewalId/manager-approval', postManagerApproval);
leaseRenewalsRouter.post('/:renewalId/tenant-signature', postTenantSignature);
leaseRenewalsRouter.post('/:renewalId/activate', postActivateRenewal);
leaseRenewalsRouter.post('/:renewalId/decline', postDeclineRenewal);
