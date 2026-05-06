import { pool } from '../config/db.js';

export async function listActiveRoles() {
  const [rows] = await pool.query(
    'SELECT IDNo AS id, ROLE AS name, ACTIVE AS active FROM user_role WHERE ACTIVE = 1 ORDER BY IDNo ASC',
  );
  return rows;
}

export async function roleExists(roleId, conn) {
  const runner = conn ?? pool;
  const [rows] = await runner.query(
    'SELECT IDNo FROM user_role WHERE IDNo = ? AND ACTIVE = 1 LIMIT 1',
    [roleId],
  );
  return Boolean(rows[0]);
}

export async function listRoleCrudPermissions(roleId) {
  const [rows] = await pool.query(
    'SELECT module_key, can_create, can_update, can_delete FROM user_role_crud_permissions WHERE role_id = ?',
    [roleId],
  );
  return rows;
}

export async function listRoleSidebarPermissions(roleId) {
  const [rows] = await pool.query(
    'SELECT feature_key FROM role_sidebar_permissions WHERE role_id = ? AND active = 1',
    [roleId],
  );
  return rows;
}

export async function replaceRoleSidebarPermissions(roleId, featureKeys) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (!(await roleExists(roleId, conn))) {
      throw new Error('ROLE_NOT_FOUND');
    }
    await conn.query('UPDATE role_sidebar_permissions SET active = 0 WHERE role_id = ? AND active = 1', [roleId]);
    for (const fk of featureKeys) {
      await conn.query(
        `INSERT INTO role_sidebar_permissions (role_id, feature_key, active) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE active = 1`,
        [roleId, fk],
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function upsertRoleCrudPermissions(roleId, modules, moduleKeys) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (!(await roleExists(roleId, conn))) {
      throw new Error('ROLE_NOT_FOUND');
    }
    for (const mk of moduleKeys) {
      const permission = modules[mk];
      const create = Boolean(permission?.create);
      const update = Boolean(permission?.update);
      const del = Boolean(permission?.delete);
      await conn.query(
        `INSERT INTO user_role_crud_permissions (role_id, module_key, can_create, can_update, can_delete)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE can_create = VALUES(can_create), can_update = VALUES(can_update), can_delete = VALUES(can_delete)`,
        [roleId, mk, create ? 1 : 0, update ? 1 : 0, del ? 1 : 0],
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export const DEFAULT_NEW_ROLE_TEMPLATE_ID = 5;
export const PROTECTED_SYSTEM_ROLE_ID = 1;

export async function userRoleRowById(roleId) {
  const [rows] = await pool.query(
    'SELECT IDNo AS id, ROLE AS name, ACTIVE AS active FROM user_role WHERE IDNo = ? LIMIT 1',
    [roleId],
  );
  return rows[0] ?? null;
}

export async function countActiveUsersForRole(roleId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS c FROM user_info WHERE PERMISSIONS = ? AND ACTIVE = 1',
    [roleId],
  );
  return Number(rows[0]?.c ?? 0);
}

export async function countUsersForRole(roleId) {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM user_info WHERE PERMISSIONS = ?', [roleId]);
  return Number(rows[0]?.c ?? 0);
}

export async function hardDeleteRole(roleId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT IDNo FROM user_role WHERE IDNo = ? FOR UPDATE', [roleId]);
    if (!rows[0]) {
      throw new Error('ROLE_NOT_FOUND');
    }
    await conn.query('DELETE FROM user_role_crud_permissions WHERE role_id = ?', [roleId]);
    await conn.query('DELETE FROM role_sidebar_permissions WHERE role_id = ?', [roleId]);
    await conn.query('DELETE FROM user_role WHERE IDNo = ?', [roleId]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function activeRoleNameTaken(trimmedName, excludeRoleId) {
  const sql = excludeRoleId
    ? `SELECT IDNo FROM user_role
       WHERE ACTIVE = 1 AND LOWER(TRIM(ROLE)) = LOWER(?) AND IDNo <> ? LIMIT 1`
    : `SELECT IDNo FROM user_role WHERE ACTIVE = 1 AND LOWER(TRIM(ROLE)) = LOWER(?) LIMIT 1`;
  const params = excludeRoleId ? [trimmedName, excludeRoleId] : [trimmedName];
  const [rows] = await pool.query(sql, params);
  return Boolean(rows[0]);
}

export async function listRolesWithManagementMeta() {
  const [rows] = await pool.query(
    `SELECT ur.IDNo AS id, ur.ROLE AS name, ur.ACTIVE AS active,
      (SELECT COUNT(*) FROM user_info ui WHERE ui.PERMISSIONS = ur.IDNo AND ui.ACTIVE = 1) AS userCount
     FROM user_role ur
     ORDER BY ur.IDNo ASC`,
  );
  return rows;
}

export async function listActiveStaffUsersForRoleAvatars() {
  const [rows] = await pool.query(
    `SELECT IDNO AS id, FIRSTNAME AS firstName, LASTNAME AS lastName, USERNAME AS username,
            AVATAR_URL AS avatarUrl, PERMISSIONS AS roleId
     FROM user_info
     WHERE ACTIVE = 1
     ORDER BY IDNO DESC`,
  );
  return rows;
}

export async function insertRoleWithCopiedPermissions(name, encodedBy, templateRoleId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [tplRows] = await conn.query(
      'SELECT IDNo FROM user_role WHERE IDNo = ? AND ACTIVE = 1 LIMIT 1',
      [templateRoleId],
    );
    if (!tplRows[0]) {
      throw new Error('TEMPLATE_ROLE_NOT_FOUND');
    }
    const [ins] = await conn.query(
      `INSERT INTO user_role (ROLE, ENCODED_BY, ENCODED_DT, EDITED_BY, EDITED_DT, ACTIVE)
       VALUES (?, ?, NOW(), NULL, NULL, 1)`,
      [name, encodedBy],
    );
    const newId = ins.insertId;
    await conn.query(
      `INSERT INTO user_role_crud_permissions (role_id, module_key, can_create, can_update, can_delete)
       SELECT ?, module_key, can_create, can_update, can_delete
       FROM user_role_crud_permissions WHERE role_id = ?`,
      [newId, templateRoleId],
    );
    await conn.query(
      `INSERT INTO role_sidebar_permissions (role_id, feature_key, active)
       SELECT ?, feature_key, active FROM role_sidebar_permissions WHERE role_id = ? AND active = 1`,
      [newId, templateRoleId],
    );
    await conn.commit();
    return Number(newId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateUserRoleRow(roleId, { name, active }, editedBy) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT IDNo FROM user_role WHERE IDNo = ? FOR UPDATE',
      [roleId],
    );
    if (!rows[0]) {
      throw new Error('ROLE_NOT_FOUND');
    }
    const fields = [];
    const params = [];
    if (name !== undefined) {
      fields.push('ROLE = ?');
      params.push(name);
    }
    if (active !== undefined) {
      fields.push('ACTIVE = ?');
      params.push(active ? 1 : 0);
    }
    if (fields.length) {
      fields.push('EDITED_BY = ?');
      fields.push('EDITED_DT = NOW()');
      params.push(editedBy);
      params.push(roleId);
      await conn.query(`UPDATE user_role SET ${fields.join(', ')} WHERE IDNo = ?`, params);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
