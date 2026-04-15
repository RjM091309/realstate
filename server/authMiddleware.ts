import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2';
import { pool } from './db.js';
import { getJwtSecret, type JwtPayload } from './jwt.js';

export interface AuthedRequest extends Request {
  userId?: number;
}

/** Verifies Bearer JWT and sets `req.userId`. */
export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

/** Requires Bearer JWT and user role Administrator (PERMISSIONS = 1). */
export async function requireAdministrator(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

  const [rows] = await pool.query<RowDataPacket[]>(
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
