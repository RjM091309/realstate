import { SIDEBAR_FEATURE_KEYS } from '../accessConfig.js';
import {
  listActiveRoles,
  listRoleCrudPermissions,
  listRoleSidebarPermissions,
  replaceRoleSidebarPermissions,
  roleExists,
  upsertRoleCrudPermissions,
} from '../models/adminModel.js';

function parseRoleId(req, res) {
  const roleId = Number(req.params.roleId);
  if (!Number.isFinite(roleId)) {
    res.status(400).json({ error: 'Invalid role' });
    return null;
  }
  return roleId;
}

export async function getRoles(_req, res) {
  try {
    const rows = await listActiveRoles();
    res.json({
      roles: rows.map((r) => ({
        id: Number(r.id),
        name: String(r.name ?? ''),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load roles' });
  }
}

export async function getRoleCrud(req, res) {
  const roleId = parseRoleId(req, res);
  if (roleId == null) return;
  try {
    if (!(await roleExists(roleId))) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    const rows = await listRoleCrudPermissions(roleId);
    const modules = {};
    for (const mk of SIDEBAR_FEATURE_KEYS) {
      modules[mk] = { create: false, update: false, delete: false };
    }
    for (const row of rows) {
      const key = String(row.module_key);
      if (!modules[key]) continue;
      modules[key] = {
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
}

export async function getRoleSidebar(req, res) {
  const roleId = parseRoleId(req, res);
  if (roleId == null) return;
  try {
    if (!(await roleExists(roleId))) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    const rows = await listRoleSidebarPermissions(roleId);
    const set = new Set(rows.map((r) => r.feature_key));
    const featureKeys = [...SIDEBAR_FEATURE_KEYS].filter((k) => set.has(k));
    res.json({ roleId, featureKeys });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load role sidebar' });
  }
}

export async function updateRoleSidebar(req, res) {
  const roleId = parseRoleId(req, res);
  if (roleId == null) return;
  const raw = req.body?.featureKeys;
  if (!Array.isArray(raw)) {
    res.status(400).json({ error: 'featureKeys must be an array' });
    return;
  }
  const allowed = new Set(SIDEBAR_FEATURE_KEYS);
  const nextKeys = raw.map((x) => String(x)).filter((k) => allowed.has(k));
  const unique = [...new Set(nextKeys)];

  try {
    await replaceRoleSidebarPermissions(roleId, unique);
    res.json({ ok: true, roleId, featureKeys: unique });
  } catch (e) {
    if (e instanceof Error && e.message === 'ROLE_NOT_FOUND') {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to save role sidebar' });
  }
}

export async function updateRoleCrud(req, res) {
  const roleId = parseRoleId(req, res);
  if (roleId == null) return;
  const body = req.body?.modules;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'modules object required' });
    return;
  }
  try {
    await upsertRoleCrudPermissions(roleId, body, SIDEBAR_FEATURE_KEYS);
    res.json({ ok: true, roleId });
  } catch (e) {
    if (e instanceof Error && e.message === 'ROLE_NOT_FOUND') {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to save role permissions' });
  }
}
