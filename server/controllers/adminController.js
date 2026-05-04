import { SIDEBAR_FEATURE_KEYS } from '../accessConfig.js';
import { emitRoleAccessChanged } from '../realtime/io.js';
import {
  DEFAULT_NEW_ROLE_TEMPLATE_ID,
  PROTECTED_SYSTEM_ROLE_ID,
  activeRoleNameTaken,
  countActiveUsersForRole,
  insertRoleWithCopiedPermissions,
  listActiveRoles,
  listActiveStaffUsersForRoleAvatars,
  listRoleCrudPermissions,
  listRoleSidebarPermissions,
  listRolesWithManagementMeta,
  replaceRoleSidebarPermissions,
  roleExists,
  updateUserRoleRow,
  upsertRoleCrudPermissions,
  userRoleRowById,
} from '../models/adminModel.js';

const ROLE_NAME_MAX = 128;
const AVATAR_PREVIEW_PER_ROLE = 5;

function parseRoleId(req, res) {
  const roleId = Number(req.params.roleId);
  if (!Number.isFinite(roleId)) {
    res.status(400).json({ error: 'Invalid role' });
    return null;
  }
  return roleId;
}

function queryFlagTrue(v) {
  const s = String(v ?? '').toLowerCase();
  return s === '1' || s === 'true';
}

export async function getRoles(req, res) {
  try {
    if (!queryFlagTrue(req.query?.includeInactive)) {
      const rows = await listActiveRoles();
      res.json({
        roles: rows.map((r) => ({
          id: Number(r.id),
          name: String(r.name ?? ''),
        })),
      });
      return;
    }

    const roleRows = await listRolesWithManagementMeta();
    const userRows = await listActiveStaffUsersForRoleAvatars();
    const byRole = new Map();
    for (const r of roleRows) {
      byRole.set(Number(r.id), {
        id: Number(r.id),
        name: String(r.name ?? ''),
        active: Boolean(Number(r.active)),
        userCount: Number(r.userCount ?? 0),
        assignedUsers: [],
      });
    }
    for (const u of userRows) {
      const rid = Number(u.roleId);
      const bucket = byRole.get(rid);
      if (!bucket || bucket.assignedUsers.length >= AVATAR_PREVIEW_PER_ROLE) continue;
      bucket.assignedUsers.push({
        id: Number(u.id),
        firstName: String(u.firstName ?? ''),
        lastName: String(u.lastName ?? ''),
        username: String(u.username ?? ''),
        avatarUrl: String(u.avatarUrl ?? '').trim() || null,
      });
    }
    res.json({ roles: [...byRole.values()] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load roles' });
  }
}

function normalizeRoleName(bodyName) {
  return String(bodyName ?? '').trim();
}

export async function createRole(req, res) {
  const name = normalizeRoleName(req.body?.name);
  const templateRoleId = Number(req.body?.templateRoleId ?? DEFAULT_NEW_ROLE_TEMPLATE_ID);

  if (!name) {
    res.status(400).json({ error: 'Role name is required' });
    return;
  }
  if (name.length > ROLE_NAME_MAX) {
    res.status(400).json({ error: `Role name must be at most ${ROLE_NAME_MAX} characters` });
    return;
  }
  if (!Number.isFinite(templateRoleId)) {
    res.status(400).json({ error: 'Invalid template role' });
    return;
  }

  try {
    if (await activeRoleNameTaken(name, null)) {
      res.status(409).json({ error: 'A role with this name already exists' });
      return;
    }
    const newId = await insertRoleWithCopiedPermissions(name, req.userId, templateRoleId);
    emitRoleAccessChanged(newId);
    res.status(201).json({
      role: { id: newId, name, active: true, userCount: 0, assignedUsers: [] },
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'TEMPLATE_ROLE_NOT_FOUND') {
      res.status(400).json({ error: 'Invalid template role' });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to create role' });
  }
}

export async function patchRole(req, res) {
  const roleId = parseRoleId(req, res);
  if (roleId == null) return;

  const nameRaw = req.body?.name;
  const activeRaw = req.body?.active;
  const hasName = nameRaw !== undefined;
  const hasActive = activeRaw !== undefined;

  if (!hasName && !hasActive) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  let name;
  if (hasName) {
    name = normalizeRoleName(nameRaw);
    if (!name) {
      res.status(400).json({ error: 'Role name is required' });
      return;
    }
    if (name.length > ROLE_NAME_MAX) {
      res.status(400).json({ error: `Role name must be at most ${ROLE_NAME_MAX} characters` });
      return;
    }
  }

  let active;
  if (hasActive) {
    if (typeof activeRaw !== 'boolean') {
      res.status(400).json({ error: 'active must be a boolean' });
      return;
    }
    active = activeRaw;
  }

  try {
    const existing = await userRoleRowById(roleId);
    if (!existing) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    if (roleId === PROTECTED_SYSTEM_ROLE_ID && hasActive && active === false) {
      res.status(400).json({ error: 'The Administrator role cannot be deactivated' });
      return;
    }

    if (hasName && (await activeRoleNameTaken(name, roleId))) {
      res.status(409).json({ error: 'A role with this name already exists' });
      return;
    }

    if (hasActive && active === false) {
      const n = await countActiveUsersForRole(roleId);
      if (n > 0) {
        res.status(400).json({ error: 'Reassign or deactivate users before deactivating this role' });
        return;
      }
    }

    await updateUserRoleRow(
      roleId,
      {
        ...(hasName ? { name } : {}),
        ...(hasActive ? { active } : {}),
      },
      req.userId,
    );
    emitRoleAccessChanged(roleId);
    const next = await userRoleRowById(roleId);
    const userCount = await countActiveUsersForRole(roleId);
    res.json({
      role: {
        id: roleId,
        name: String(next?.name ?? ''),
        active: Boolean(Number(next?.active)),
        userCount,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'ROLE_NOT_FOUND') {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to update role' });
  }
}

export async function deleteRole(req, res) {
  const roleId = parseRoleId(req, res);
  if (roleId == null) return;

  if (roleId === PROTECTED_SYSTEM_ROLE_ID) {
    res.status(400).json({ error: 'The Administrator role cannot be removed' });
    return;
  }

  try {
    const existing = await userRoleRowById(roleId);
    if (!existing) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    if (!Number(existing.active)) {
      res.json({ ok: true, roleId, alreadyInactive: true });
      return;
    }
    const n = await countActiveUsersForRole(roleId);
    if (n > 0) {
      res.status(400).json({ error: 'Reassign or deactivate users before removing this role' });
      return;
    }
    await updateUserRoleRow(roleId, { active: false }, req.userId);
    emitRoleAccessChanged(roleId);
    res.json({ ok: true, roleId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to remove role' });
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
    emitRoleAccessChanged(roleId);
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
    emitRoleAccessChanged(roleId);
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
