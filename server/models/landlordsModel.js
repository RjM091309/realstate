import { pool } from '../config/db.js';

export async function listLandlordsByBranch(branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      branch_id,
      full_name,
      mobile_no,
      email,
      gov_id_no,
      active,
      created_at
    FROM landlord_profile
    WHERE (branch_id = ? OR branch_id IS NULL)
      AND active = 1
    ORDER BY created_at DESC, id DESC
    `,
    [branchId],
  );
  return rows;
}

export async function getLandlordById(id, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      branch_id,
      full_name,
      mobile_no,
      email,
      gov_id_no,
      active,
      created_at
    FROM landlord_profile
    WHERE id = ?
      AND (branch_id = ? OR branch_id IS NULL)
      AND active = 1
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function insertLandlord(branchId, payload) {
  const [result] = await pool.query(
    `
    INSERT INTO landlord_profile (
      branch_id,
      full_name,
      mobile_no,
      email,
      gov_id_no,
      active
    ) VALUES (?, ?, ?, ?, ?, 1)
    `,
    [branchId, payload.fullName, payload.mobileNo ?? null, payload.email ?? null, payload.govIdNo ?? null],
  );
  return result.insertId;
}

export async function updateLandlordById(id, branchId, payload) {
  const [result] = await pool.query(
    `
    UPDATE landlord_profile
    SET
      full_name = ?,
      mobile_no = ?,
      email = ?,
      gov_id_no = ?
    WHERE id = ?
      AND (branch_id = ? OR branch_id IS NULL)
      AND active = 1
    `,
    [payload.fullName, payload.mobileNo ?? null, payload.email ?? null, payload.govIdNo ?? null, id, branchId],
  );
  return result.affectedRows;
}

export async function deactivateLandlordById(id, branchId) {
  const [result] = await pool.query(
    `
    UPDATE landlord_profile
    SET active = 0
    WHERE id = ?
      AND (branch_id = ? OR branch_id IS NULL)
      AND active = 1
    `,
    [id, branchId],
  );
  return result.affectedRows;
}

