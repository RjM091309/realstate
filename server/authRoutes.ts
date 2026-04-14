import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { loadSessionPayload } from './session.js';
import { getJwtSecret, type JwtPayload } from './jwt.js';

const router = Router();

export type { JwtPayload };

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!username || !password) {
      res.status(400).json({ error: 'Missing username or password' });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT IDNO, USERNAME, \`PASSWORD\`, FIRSTNAME, LASTNAME, PERMISSIONS, BRANCH_ID, ACTIVE
       FROM user_info WHERE USERNAME = ? LIMIT 1`,
      [username],
    );

    const row = rows[0];
    if (!row || row.ACTIVE !== 1) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const ok = await bcrypt.compare(password, String(row.PASSWORD ?? ''));
    if (!ok) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const userId = Number(row.IDNO);
    const payload: JwtPayload = { userId };

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
    const session = await loadSessionPayload(userId);

    if (!session) {
      res.status(500).json({ error: 'Could not load session' });
      return;
    }

    res.json({ token, session });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/session', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    } catch {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const session = await loadSessionPayload(decoded.userId);
    if (!session) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.json({ session });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Session failed' });
  }
});

router.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

export { router as authRouter };
