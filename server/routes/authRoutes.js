import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import {
  changePassword,
  createStaffUser,
  deactivateStaffUser,
  deleteProfilePhoto,
  getSession,
  getRoles,
  listStaffBranches,
  listStaffUsers,
  login,
  logout,
  register,
  updateProfile,
  updateStaffUser,
  uploadProfilePhoto,
} from '../controllers/authController.js';
import { requireAuth, requireAdministrator } from '../middlewares/authMiddleware.js';

const profilePhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(process.cwd(), 'server', 'uploads', 'avatars');
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // ignore
      }
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const router = Router();
router.get('/roles', getRoles);
router.post('/register', register);
router.get('/staff/branches', requireAdministrator, listStaffBranches);
router.get('/staff/users', requireAdministrator, listStaffUsers);
router.post('/staff/users', requireAdministrator, createStaffUser);
router.patch('/staff/users/:userId', requireAdministrator, updateStaffUser);
router.delete('/staff/users/:userId', requireAdministrator, deactivateStaffUser);
router.post('/login', login);
router.get('/session', getSession);
router.post('/logout', logout);
router.post('/change-password', requireAuth, changePassword);
router.patch('/profile', requireAuth, updateProfile);
router.post('/profile-photo', requireAuth, profilePhotoUpload.single('file'), uploadProfilePhoto);
router.delete('/profile-photo', requireAuth, deleteProfilePhoto);

export { router as authRouter };
