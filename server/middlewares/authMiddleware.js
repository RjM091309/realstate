import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { getJwtSecret } from '../jwt.js';

function allowDevBypass() {
  return (
    process.env.NODE_ENV !== 'production' &&
    String(process.env.ALLOW_BYPASS_AUTH ?? 'true').toLowerCase() === 'true'
  );
}

function readDevUserId(req) {
  const devUserId = req.headers['x-dev-user-id'];
  if (devUserId == null) return null;
  const v = String(devUserId).trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Verifies Bearer JWT and sets `req.userId`. */
export async function requireAuth(req, res, next) {
  // Dev-only bypass for local development when the UI is running with BYPASS_LOGIN enabled.
  // In non-production, this is enabled by default (or can be explicitly enabled via `.env`).
  // Never enable in production.
  const devUserId = readDevUserId(req);
  if (allowDevBypass() && devUserId != null) {
    req.userId = devUserId;
    next();
    return;
  }

  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

/** Requires Bearer JWT and user role Administrator (PERMISSIONS = 1). */
export async function requireAdministrator(req, res, next) {
  const userId = readDevUserId(req);
  if (allowDevBypass() && userId != null) {
    const [rows] = await pool.query(
      'SELECT PERMISSIONS FROM user_info WHERE IDNO = ? AND ACTIVE = 1 LIMIT 1',
      [userId],
    );
    const roleId = Number(rows[0]?.PERMISSIONS);
    if (roleId !== 1) {
      res.status(403).json({ error: 'Administrator only' });
      return;
    }
    req.userId = userId;
    next();
    return;
  }

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

  const [rows] = await pool.query(
    'SELECT PERMISSIONS FROM user_info WHERE IDNO = ? AND ACTIVE = 1 LIMIT 1',
    [decoded.userId],
  );
  const roleId = Number(rows[0]?.PERMISSIONS);
  if (roleId !== 1) {
    res.status(403).json({ error: 'Administrator only' });
    return;
  }

  req.userId = decoded.userId;
  next();
}
