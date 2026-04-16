import { Router } from 'express';
import { getSession, getRoles, login, logout, register } from '../controllers/authController.js';

const router = Router();
router.get('/roles', getRoles);
router.post('/register', register);
router.post('/login', login);
router.get('/session', getSession);
router.post('/logout', logout);

export { router as authRouter };
