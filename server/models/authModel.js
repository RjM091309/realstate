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

export async function findUserById(userId) {
  const [rows] = await pool.query(
    `SELECT IDNO, USERNAME, \`PASSWORD\`, ACTIVE
     FROM user_info
     WHERE IDNO = ?
     LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function updateUserPasswordHash(userId, passwordHash) {
  await pool.execute(
    `UPDATE user_info SET \`PASSWORD\` = ?, EDITED_DT = NOW() WHERE IDNO = ? AND ACTIVE = 1`,
    [passwordHash, userId],
  );
}

export async function updateUserProfile(userId, { firstName, lastName }) {
  await pool.execute(
    `UPDATE user_info SET FIRSTNAME = ?, LASTNAME = ?, EDITED_DT = NOW() WHERE IDNO = ? AND ACTIVE = 1`,
    [firstName, lastName, userId],
  );
}

export async function getUserAvatarUrl(userId) {
  const [rows] = await pool.query(
    `SELECT AVATAR_URL FROM user_info WHERE IDNO = ? AND ACTIVE = 1 LIMIT 1`,
    [userId],
  );
  const v = rows[0]?.AVATAR_URL;
  return v != null && String(v).trim() !== '' ? String(v) : null;
}

export async function updateUserAvatarUrl(userId, avatarUrl) {
  await pool.execute(
    `UPDATE user_info SET AVATAR_URL = ?, EDITED_DT = NOW() WHERE IDNO = ? AND ACTIVE = 1`,
    [avatarUrl ?? null, userId],
  );
}

/** Admin staff UI: set avatar for any account (including inactive). */
export async function setUserAvatarByUserId(userId, avatarUrl) {
  await pool.execute(
    `UPDATE user_info SET AVATAR_URL = ?, EDITED_DT = NOW() WHERE IDNO = ?`,
    [avatarUrl ?? null, userId],
  );
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
      LAST_LOGIN, ENCODED_BY, ENCODED_DT, EDITED_BY, EDITED_DT, ACTIVE, PENDING_APPROVAL, BRANCH_ID
    ) VALUES (?, ?, ?, ?, NULL, ?, NULL, NULL, NOW(), NULL, NULL, 1, 0, ?)`,
    [
      params.firstName,
      params.lastName,
      params.username,
      params.passwordHash,
      params.roleId,
      params.branchId ?? null,
    ],
  );
  return Number(insertResult.insertId);
}

/** Public self-signup: inactive + pending until an administrator approves it. */
export async function createPendingUserAccount(params) {
  const [insertResult] = await pool.execute(
    `INSERT INTO user_info (
      FIRSTNAME, LASTNAME, USERNAME, PASSWORD, SALT, PERMISSIONS,
      LAST_LOGIN, ENCODED_BY, ENCODED_DT, EDITED_BY, EDITED_DT, ACTIVE, PENDING_APPROVAL, BRANCH_ID
    ) VALUES (?, ?, ?, ?, NULL, ?, NULL, NULL, NOW(), NULL, NULL, 0, 1, ?)`,
    [
      params.firstName,
      params.lastName,
      params.username,
      params.passwordHash,
      params.roleId,
      params.branchId ?? null,
    ],
  );
  return Number(insertResult.insertId);
}

/** Approve a pending sign-up: activates the account and clears the pending flag. */
export async function approvePendingUserAccount(userId) {
  await pool.execute(
    `UPDATE user_info SET ACTIVE = 1, PENDING_APPROVAL = 0, EDITED_DT = NOW() WHERE IDNO = ? AND PENDING_APPROVAL = 1`,
    [userId],
  );
}

/** Reject a pending sign-up: the account never went live, so it's removed outright. */
export async function deletePendingUserAccount(userId) {
  const [result] = await pool.execute(
    `DELETE FROM user_info WHERE IDNO = ? AND PENDING_APPROVAL = 1`,
    [userId],
  );
  return result.affectedRows > 0;
}

export async function listBranchesActive() {
  const [rows] = await pool.query(
    'SELECT id, name, code FROM branch WHERE ACTIVE = 1 ORDER BY id ASC',
  );
  return rows;
}

export async function getBranchByIdActive(branchId) {
  const [rows] = await pool.query(
    'SELECT id FROM branch WHERE id = ? AND ACTIVE = 1 LIMIT 1',
    [branchId],
  );
  return rows[0] ?? null;
}

export async function listStaffUsersJoined() {
  const [rows] = await pool.query(
    `SELECT u.IDNO, u.FIRSTNAME, u.LASTNAME, u.USERNAME, u.PERMISSIONS, u.BRANCH_ID, u.ACTIVE, u.PENDING_APPROVAL, u.AVATAR_URL,
            r.ROLE AS roleName, b.name AS branchName
     FROM user_info u
     LEFT JOIN user_role r ON r.IDNo = u.PERMISSIONS
     LEFT JOIN branch b ON b.id = u.BRANCH_ID
     ORDER BY u.PENDING_APPROVAL DESC, u.IDNO ASC`,
  );
  return rows;
}

export async function getStaffUserJoined(userId) {
  const [rows] = await pool.query(
    `SELECT u.IDNO, u.FIRSTNAME, u.LASTNAME, u.USERNAME, u.PERMISSIONS, u.BRANCH_ID, u.ACTIVE, u.PENDING_APPROVAL, u.AVATAR_URL,
            r.ROLE AS roleName, b.name AS branchName
     FROM user_info u
     LEFT JOIN user_role r ON r.IDNo = u.PERMISSIONS
     LEFT JOIN branch b ON b.id = u.BRANCH_ID
     WHERE u.IDNO = ?
     LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function findUserRowById(userId) {
  const [rows] = await pool.query(
    `SELECT IDNO, USERNAME, FIRSTNAME, LASTNAME, PERMISSIONS, BRANCH_ID, ACTIVE, PENDING_APPROVAL, AVATAR_URL
     FROM user_info WHERE IDNO = ? LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function usernameTakenByOther(username, excludeUserId) {
  const [rows] = await pool.query(
    'SELECT IDNO FROM user_info WHERE USERNAME = ? AND IDNO != ? LIMIT 1',
    [username, excludeUserId],
  );
  return Boolean(rows[0]);
}

export async function updateUserPasswordById(userId, passwordHash) {
  await pool.execute(
    `UPDATE user_info SET \`PASSWORD\` = ?, EDITED_DT = NOW() WHERE IDNO = ?`,
    [passwordHash, userId],
  );
}

export async function updateUserStaffFields(userId, fields) {
  const parts = [];
  const vals = [];
  if (fields.firstName != null) {
    parts.push('FIRSTNAME = ?');
    vals.push(fields.firstName);
  }
  if (fields.lastName != null) {
    parts.push('LASTNAME = ?');
    vals.push(fields.lastName);
  }
  if (fields.username != null) {
    parts.push('USERNAME = ?');
    vals.push(fields.username);
  }
  if (fields.roleId != null) {
    parts.push('PERMISSIONS = ?');
    vals.push(fields.roleId);
  }
  if (fields.branchId !== undefined) {
    parts.push('BRANCH_ID = ?');
    vals.push(fields.branchId);
  }
  if (fields.active != null) {
    parts.push('ACTIVE = ?');
    vals.push(fields.active ? 1 : 0);
  }
  if (!parts.length) return;
  parts.push('EDITED_DT = NOW()');
  vals.push(userId);
  await pool.execute(`UPDATE user_info SET ${parts.join(', ')} WHERE IDNO = ?`, vals);
}
