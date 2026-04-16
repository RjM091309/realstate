import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { getJwtSecret } from '../jwt.js';

/** Verifies Bearer JWT and sets `req.userId`. */
export async function requireAuth(req, res, next) {
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
