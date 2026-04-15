import { Router, type Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { loadSessionPayload } from './session.js';
import { getJwtSecret, type JwtPayload } from './jwt.js';

const router = Router();

export type { JwtPayload };

async function sendTokenAndSession(
  res: Response,
  userId: number,
  opts?: { status?: number; sessionError?: string },
): Promise<void> {
  const status = opts?.status ?? 200;
  const sessionError = opts?.sessionError ?? 'Could not load session';
  const payload: JwtPayload = { userId };
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(500).json({ error: sessionError });
    return;
  }
  const body = { token, session };
  if (status === 201) res.status(201).json(body);
  else res.json(body);
}

router.get('/roles', async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT IDNo, ROLE FROM user_role WHERE ACTIVE = 1 ORDER BY IDNo ASC`,
    );
    res.json({
      roles: rows.map((r) => ({
        id: Number(r.IDNo),
        name: String(r.ROLE ?? ''),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load roles' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const firstName = String(req.body?.firstName ?? '').trim();
    const lastName = String(req.body?.lastName ?? '').trim();
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    const roleId = Number(req.body?.roleId);

    if (!firstName || !lastName || !username || !password) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    if (!Number.isFinite(roleId) || roleId < 1) {
      res.status(400).json({ error: 'Choose a valid role' });
      return;
    }
    if (firstName.length > 128 || lastName.length > 128) {
      res.status(400).json({ error: 'Name fields are too long' });
      return;
    }
    if (username.length < 3 || username.length > 64) {
      res.status(400).json({ error: 'Username must be between 3 and 64 characters' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const [roleRows] = await pool.query<RowDataPacket[]>(
      `SELECT IDNo FROM user_role WHERE IDNo = ? AND ACTIVE = 1 LIMIT 1`,
      [roleId],
    );
    if (!roleRows[0]) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const [branchRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM branch WHERE ACTIVE = 1 ORDER BY id ASC LIMIT 1`,
    );
    const branchId = branchRows[0] ? Number(branchRows[0].id) : 1;

    const [dup] = await pool.query<RowDataPacket[]>(
      `SELECT IDNO FROM user_info WHERE USERNAME = ? LIMIT 1`,
      [username],
    );
    if (dup[0]) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const [insertResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO user_info (
        FIRSTNAME, LASTNAME, USERNAME, PASSWORD, SALT, PERMISSIONS,
        LAST_LOGIN, ENCODED_BY, ENCODED_DT, EDITED_BY, EDITED_DT, ACTIVE, BRANCH_ID
      ) VALUES (?, ?, ?, ?, NULL, ?, NULL, NULL, NOW(), NULL, NULL, 1, ?)`,
      [firstName, lastName, username, hash, roleId, branchId],
    );

    const userId = Number(insertResult.insertId);
    if (!Number.isFinite(userId) || userId < 1) {
      res.status(500).json({ error: 'Registration failed' });
      return;
    }

    await sendTokenAndSession(res, userId, {
      status: 201,
      sessionError: 'Account created but session could not be loaded',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

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
    await sendTokenAndSession(res, userId);
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
