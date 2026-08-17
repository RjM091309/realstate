import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  addInspectionPhoto,
  approveInspectionAction,
  failInspectionAction,
  downloadInspectionReport,
  getContractInspection,
  listBranchInspectionsForCalendar,
  patchChecklistItem,
  patchInspection,
  patchInventoryItem,
  removeInspectionPhoto,
  saveInspectionDraft,
  scheduleMoveInAction,
  startContractInspection,
} from '../controllers/unitInspectionsController.js';

const router = Router();
router.use(requireAuth);

router.get('/', listBranchInspectionsForCalendar);
router.get('/contracts/:contractId', getContractInspection);
router.post('/contracts/:contractId/start', startContractInspection);

router.patch('/:inspectionId', patchInspection);
router.patch('/:inspectionId/checklist/:itemId', patchChecklistItem);
router.patch('/:inspectionId/inventory/:itemId', patchInventoryItem);
router.post('/:inspectionId/photos', addInspectionPhoto);
router.delete('/:inspectionId/photos/:photoId', removeInspectionPhoto);
router.post('/:inspectionId/save-draft', saveInspectionDraft);
router.post('/:inspectionId/approve', approveInspectionAction);
router.post('/:inspectionId/fail', failInspectionAction);
router.post('/:inspectionId/schedule-move-in', scheduleMoveInAction);
router.get('/:inspectionId/report.pdf', downloadInspectionReport);

export { router as unitInspectionsRouter };
