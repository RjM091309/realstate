import type { RowDataPacket } from 'mysql2';
import { pool } from './db.js';

export function featureKeyToTabId(featureKey: string): string {
  if (featureKey === 'tenant_portal') return 'portal';
  if (featureKey === 'agent_portal') return 'agentPortal';
  return featureKey;
}

export interface SessionPayload {
  user: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
  };
  role: { id: number; name: string };
  branchId: number;
  sidebarTabIds: string[];
  crud: Record<string, { create: boolean; update: boolean; delete: boolean }>;
}

export async function loadSessionPayload(userId: number): Promise<SessionPayload | null> {
  const [users] = await pool.query<RowDataPacket[]>(
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

  const [sidebarRows] = await pool.query<RowDataPacket[]>(
    `SELECT feature_key FROM role_sidebar_permissions WHERE role_id = ?`,
    [roleId],
  );

  const sidebarTabIds = (sidebarRows as { feature_key: string }[]).map((r) =>
    featureKeyToTabId(r.feature_key),
  );

  const [crudRows] = await pool.query<RowDataPacket[]>(
    `SELECT module_key, can_create, can_update, can_delete
     FROM user_role_crud_permissions WHERE role_id = ?`,
    [roleId],
  );

  const crud: SessionPayload['crud'] = {};
  for (const row of crudRows as RowDataPacket[]) {
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
