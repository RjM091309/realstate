import { Router } from 'express';
import { requireAdministrator } from '../middlewares/authMiddleware.js';
import {
  getRoleCrud,
  getRoles,
  getRoleSidebar,
  updateRoleCrud,
  updateRoleSidebar,
} from '../controllers/adminController.js';

const router = Router();
router.use(requireAdministrator);
router.get('/roles', getRoles);
router.get('/roles/:roleId/crud', getRoleCrud);
router.get('/roles/:roleId/sidebar', getRoleSidebar);
router.put('/roles/:roleId/sidebar', updateRoleSidebar);
router.put('/roles/:roleId/crud', updateRoleCrud);

export { router as adminRouter };
