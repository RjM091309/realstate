import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../jwt.js';
import { loadSessionPayload } from '../services/sessionService.js';
import {
  createUserAccount,
  findUserByUsername,
  getActiveRoleById,
  getFirstActiveBranchId,
  listActiveRoles,
  usernameExists,
} from '../models/authModel.js';

async function sendTokenAndSession(res, userId, opts) {
  const status = opts?.status ?? 200;
  const sessionError = opts?.sessionError ?? 'Could not load session';
  const payload = { userId };
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

export async function getRoles(_req, res) {
  try {
    const rows = await listActiveRoles();
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
}

export async function register(req, res) {
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

    const role = await getActiveRoleById(roleId);
    if (!role) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const dup = await usernameExists(username);
    if (dup) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const branchId = await getFirstActiveBranchId();
    const hash = await bcrypt.hash(password, 10);
    const userId = await createUserAccount({
      firstName,
      lastName,
      username,
      passwordHash: hash,
      roleId,
      branchId,
    });
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
}

export async function login(req, res) {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!username || !password) {
      res.status(400).json({ error: 'Missing username or password' });
      return;
    }

    const row = await findUserByUsername(username);
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
}

export async function getSession(req, res) {
  try {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
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
}

export function logout(_req, res) {
  res.json({ ok: true });
}
