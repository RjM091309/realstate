import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from './db.js';
import { requireAdministrator } from './authMiddleware.js';
import { SIDEBAR_FEATURE_KEYS, type SidebarFeatureKey } from './accessConfig.js';

const router = Router();
router.use(requireAdministrator);

router.get('/roles', async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT IDNo AS id, ROLE AS name, ACTIVE AS active FROM user_role WHERE ACTIVE = 1 ORDER BY IDNo ASC',
    );
    res.json({
      roles: (rows as { id: number; name: string; active: number }[]).map((r) => ({
        id: Number(r.id),
        name: String(r.name ?? ''),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load roles' });
  }
});

type CrudRow = { module_key: string; can_create: number; can_update: number; can_delete: number };

router.get('/roles/:roleId/crud', async (req, res) => {
  const roleId = Number(req.params.roleId);
  if (!Number.isFinite(roleId)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }
  try {
    const [[exists]] = await pool.query<RowDataPacket[]>(
      'SELECT IDNo FROM user_role WHERE IDNo = ? AND ACTIVE = 1 LIMIT 1',
      [roleId],
    );
    if (!exists) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT module_key, can_create, can_update, can_delete FROM user_role_crud_permissions WHERE role_id = ?',
      [roleId],
    );
    const modules: Record<string, { create: boolean; update: boolean; delete: boolean }> = {};
    for (const mk of SIDEBAR_FEATURE_KEYS) {
      modules[mk] = { create: false, update: false, delete: false };
    }
    for (const row of rows as CrudRow[]) {
      const k = String(row.module_key);
      if (!modules[k]) continue;
      modules[k] = {
        create: Boolean(row.can_create),
        update: Boolean(row.can_update),
        delete: Boolean(row.can_delete),
      };
    }
    res.json({ roleId, modules });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load role permissions' });
  }
});

router.get('/roles/:roleId/sidebar', async (req, res) => {
  const roleId = Number(req.params.roleId);
  if (!Number.isFinite(roleId)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }
  try {
    const [[exists]] = await pool.query<RowDataPacket[]>(
      'SELECT IDNo FROM user_role WHERE IDNo = ? AND ACTIVE = 1 LIMIT 1',
      [roleId],
    );
    if (!exists) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT feature_key FROM role_sidebar_permissions WHERE role_id = ?',
      [roleId],
    );
    const set = new Set((rows as { feature_key: string }[]).map((r) => r.feature_key));
    const featureKeys = [...SIDEBAR_FEATURE_KEYS].filter((k) => set.has(k));
    res.json({ roleId, featureKeys });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load role sidebar' });
  }
});

router.put('/roles/:roleId/sidebar', async (req, res) => {
  const roleId = Number(req.params.roleId);
  if (!Number.isFinite(roleId)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }
  const raw = req.body?.featureKeys;
  if (!Array.isArray(raw)) {
    res.status(400).json({ error: 'featureKeys must be an array' });
    return;
  }
  const allowed = new Set<string>(SIDEBAR_FEATURE_KEYS);
  const nextKeys = raw
    .map((x) => String(x))
    .filter((k): k is SidebarFeatureKey => allowed.has(k));
  const unique = [...new Set(nextKeys)];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[exists]] = await conn.query<RowDataPacket[]>(
      'SELECT IDNo FROM user_role WHERE IDNo = ? AND ACTIVE = 1 LIMIT 1',
      [roleId],
    );
    if (!exists) {
      await conn.rollback();
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    await conn.query('DELETE FROM role_sidebar_permissions WHERE role_id = ?', [roleId]);
    for (const fk of unique) {
      await conn.query(
        'INSERT INTO role_sidebar_permissions (role_id, feature_key) VALUES (?, ?)',
        [roleId, fk],
      );
    }
    await conn.commit();
    res.json({ ok: true, roleId, featureKeys: unique });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Failed to save role sidebar' });
  } finally {
    conn.release();
  }
});

router.put('/roles/:roleId/crud', async (req, res) => {
  const roleId = Number(req.params.roleId);
  if (!Number.isFinite(roleId)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }
  const body = req.body?.modules;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'modules object required' });
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[exists]] = await conn.query<RowDataPacket[]>(
      'SELECT IDNo FROM user_role WHERE IDNo = ? AND ACTIVE = 1 LIMIT 1',
      [roleId],
    );
    if (!exists) {
      await conn.rollback();
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    for (const mk of SIDEBAR_FEATURE_KEYS) {
      const m = body[mk];
      const create = Boolean(m?.create);
      const update = Boolean(m?.update);
      const del = Boolean(m?.delete);
      await conn.query(
        `INSERT INTO user_role_crud_permissions (role_id, module_key, can_create, can_update, can_delete)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE can_create = VALUES(can_create), can_update = VALUES(can_update), can_delete = VALUES(can_delete)`,
        [roleId, mk, create ? 1 : 0, update ? 1 : 0, del ? 1 : 0],
      );
    }
    await conn.commit();
    res.json({ ok: true, roleId });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Failed to save role permissions' });
  } finally {
    conn.release();
  }
});

export { router as adminRouter };
