import { loadSessionPayload } from '../services/sessionService.js';
import {
  getUserBranchId,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from '../models/notificationsModel.js';

function rowToNotification(row) {
  const createdAt = row.created_at;
  const iso =
    createdAt instanceof Date ? createdAt.toISOString() : typeof createdAt === 'string' ? createdAt : '';
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    message: String(row.message ?? ''),
    time: iso,
    type: String(row.type ?? 'success'),
    unread: Boolean(row.unread),
  };
}

async function getAuthContext(req, res) {
  const userId = req.userId;
  if (userId == null) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const branchId = session.branchId ?? (await getUserBranchId(userId));
  return { userId, session, branchId };
}

export async function listNotifications(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const limitRaw = req.query?.limit;
    const limit = limitRaw != null ? Number(limitRaw) : 40;
    const rows = await listNotificationsForUser(ctx.userId, ctx.branchId, limit);
    res.json({ notifications: rows.map(rowToNotification) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
}

export async function markAllRead(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    await markAllNotificationsRead(ctx.userId, ctx.branchId);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
}

export async function markOneRead(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const key = String(req.params.key ?? '').trim();
  if (!key) {
    res.status(400).json({ error: 'Invalid notification key' });
    return;
  }
  try {
    await markNotificationRead(ctx.userId, key);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
}

