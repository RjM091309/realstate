import { Router } from 'express';
import { requireAdministrator } from '../middlewares/authMiddleware.js';
import {
  createRole,
  deleteRole,
  getRoleCrud,
  getRoles,
  getRoleSidebar,
  patchRole,
  updateRoleCrud,
  updateRoleSidebar,
} from '../controllers/adminController.js';

const router = Router();
router.use(requireAdministrator);
router.get('/roles', getRoles);
router.post('/roles', createRole);
router.patch('/roles/:roleId', patchRole);
router.delete('/roles/:roleId', deleteRole);
router.get('/roles/:roleId/crud', getRoleCrud);
router.get('/roles/:roleId/sidebar', getRoleSidebar);
router.put('/roles/:roleId/sidebar', updateRoleSidebar);
router.put('/roles/:roleId/crud', updateRoleCrud);

export { router as adminRouter };
