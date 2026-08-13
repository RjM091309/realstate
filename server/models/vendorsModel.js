import { pool } from '../config/db.js';

export async function listVendorsByBranch(branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      id, branch_id, name, category, contact_person, phone, email, address, notes,
      active, created_at, updated_at
    FROM vendor
    WHERE branch_id = ? AND active = 1
    ORDER BY name ASC
    `,
    [branchId],
  );
  return rows;
}

export async function getVendorById(id, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      id, branch_id, name, category, contact_person, phone, email, address, notes,
      active, created_at, updated_at
    FROM vendor
    WHERE id = ? AND branch_id = ?
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function insertVendor(branchId, payload) {
  const [result] = await pool.query(
    `
    INSERT INTO vendor (branch_id, name, category, contact_person, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      branchId,
      payload.name,
      payload.category,
      payload.contactPerson ?? null,
      payload.phone ?? null,
      payload.email ?? null,
      payload.address ?? null,
      payload.notes ?? null,
    ],
  );
  return result.insertId;
}

export async function updateVendor(id, branchId, payload) {
  const [result] = await pool.query(
    `
    UPDATE vendor
    SET name = ?, category = ?, contact_person = ?, phone = ?, email = ?, address = ?, notes = ?, updated_at = NOW()
    WHERE id = ? AND branch_id = ?
    `,
    [
      payload.name,
      payload.category,
      payload.contactPerson ?? null,
      payload.phone ?? null,
      payload.email ?? null,
      payload.address ?? null,
      payload.notes ?? null,
      id,
      branchId,
    ],
  );
  return result.affectedRows;
}

export async function softDeleteVendor(id, branchId) {
  const [result] = await pool.query(
    `UPDATE vendor SET active = 0, updated_at = NOW() WHERE id = ? AND branch_id = ?`,
    [id, branchId],
  );
  return result.affectedRows;
}
