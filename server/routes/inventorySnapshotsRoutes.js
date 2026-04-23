import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createInventorySnapshot,
  createInventorySnapshotItem,
  listContractInventorySnapshots,
  listInventorySnapshotItemsView,
  patchInventorySnapshot,
  patchInventorySnapshotItem,
  removeInventorySnapshot,
  removeInventorySnapshotItem,
} from '../controllers/inventorySnapshotsController.js';

const router = Router();
router.use(requireAuth);

router.get('/contracts/:contractId', listContractInventorySnapshots);
router.get('/snapshots/:snapshotId/items', listInventorySnapshotItemsView);

router.post('/snapshots', createInventorySnapshot);
router.post('/items', createInventorySnapshotItem);

router.patch('/snapshots/:snapshotId', patchInventorySnapshot);
router.delete('/snapshots/:snapshotId', removeInventorySnapshot);
router.patch('/items/:itemId', patchInventorySnapshotItem);
router.delete('/items/:itemId', removeInventorySnapshotItem);

export { router as inventorySnapshotsRouter };

