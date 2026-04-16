import { pool } from '../config/db.js';

export async function listActiveRoles() {
  const [rows] = await pool.query(
    'SELECT IDNo, ROLE FROM user_role WHERE ACTIVE = 1 ORDER BY IDNo ASC',
  );
  return rows;
}

export async function getActiveRoleById(roleId) {
  const [rows] = await pool.query(
    'SELECT IDNo FROM user_role WHERE IDNo = ? AND ACTIVE = 1 LIMIT 1',
    [roleId],
  );
  return rows[0] ?? null;
}

export async function getFirstActiveBranchId() {
  const [rows] = await pool.query(
    'SELECT id FROM branch WHERE ACTIVE = 1 ORDER BY id ASC LIMIT 1',
  );
  return rows[0] ? Number(rows[0].id) : 1;
}

export async function findUserByUsername(username) {
  const [rows] = await pool.query(
    `SELECT IDNO, USERNAME, \`PASSWORD\`, FIRSTNAME, LASTNAME, PERMISSIONS, BRANCH_ID, ACTIVE
     FROM user_info
     WHERE USERNAME = ?
     LIMIT 1`,
    [username],
  );
  return rows[0] ?? null;
}

export async function usernameExists(username) {
  const [rows] = await pool.query('SELECT IDNO FROM user_info WHERE USERNAME = ? LIMIT 1', [
    username,
  ]);
  return Boolean(rows[0]);
}

export async function createUserAccount(params) {
  const [insertResult] = await pool.execute(
    `INSERT INTO user_info (
      FIRSTNAME, LASTNAME, USERNAME, PASSWORD, SALT, PERMISSIONS,
      LAST_LOGIN, ENCODED_BY, ENCODED_DT, EDITED_BY, EDITED_DT, ACTIVE, BRANCH_ID
    ) VALUES (?, ?, ?, ?, NULL, ?, NULL, NULL, NOW(), NULL, NULL, 1, ?)`,
    [
      params.firstName,
      params.lastName,
      params.username,
      params.passwordHash,
      params.roleId,
      params.branchId,
    ],
  );
  return Number(insertResult.insertId);
}
