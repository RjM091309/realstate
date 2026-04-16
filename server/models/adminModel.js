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
    'SELECT feature_key FROM role_sidebar_permissions WHERE role_id = ?',
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
    await conn.query('DELETE FROM role_sidebar_permissions WHERE role_id = ?', [roleId]);
    for (const fk of featureKeys) {
      await conn.query('INSERT INTO role_sidebar_permissions (role_id, feature_key) VALUES (?, ?)', [
        roleId,
        fk,
      ]);
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
