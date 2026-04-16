import { pool } from '../config/db.js';

export function featureKeyToTabId(featureKey) {
  if (featureKey === 'tenant_portal') return 'portal';
  if (featureKey === 'agent_portal') return 'agentPortal';
  return featureKey;
}

export async function loadSessionPayload(userId) {
  const [users] = await pool.query(
    `SELECT u.IDNO, u.USERNAME, u.FIRSTNAME, u.LASTNAME, u.PERMISSIONS, u.BRANCH_ID, u.ACTIVE,
            r.ROLE AS roleName, r.ACTIVE AS roleActive
     FROM user_info u
     INNER JOIN user_role r ON r.IDNo = u.PERMISSIONS
     WHERE u.IDNO = ? AND u.ACTIVE = 1 AND r.ACTIVE = 1
     LIMIT 1`,
    [userId],
  );

  const u = users[0];
  if (!u) return null;

  const roleId = Number(u.PERMISSIONS);
  const effectiveBranch = u.BRANCH_ID != null ? Number(u.BRANCH_ID) : 1;

  const [sidebarRows] = await pool.query(
    'SELECT feature_key FROM role_sidebar_permissions WHERE role_id = ?',
    [roleId],
  );

  const sidebarTabIds = sidebarRows.map((r) => featureKeyToTabId(r.feature_key));

  const [crudRows] = await pool.query(
    `SELECT module_key, can_create, can_update, can_delete
     FROM user_role_crud_permissions WHERE role_id = ?`,
    [roleId],
  );

  const crud = {};
  for (const row of crudRows) {
    crud[String(row.module_key)] = {
      create: Boolean(row.can_create),
      update: Boolean(row.can_update),
      delete: Boolean(row.can_delete),
    };
  }

  return {
    user: {
      id: Number(u.IDNO),
      username: String(u.USERNAME),
      firstName: String(u.FIRSTNAME ?? ''),
      lastName: String(u.LASTNAME ?? ''),
    },
    role: {
      id: roleId,
      name: String(u.roleName ?? ''),
    },
    branchId: effectiveBranch,
    sidebarTabIds,
    crud,
  };
}
