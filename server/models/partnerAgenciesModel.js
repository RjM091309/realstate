import { pool } from '../config/db.js';

export async function listPartnerAgenciesByBranch(branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      branch_id,
      agency_name,
      contact_person,
      contact_number,
      email,
      active
    FROM partner_agency
    WHERE branch_id = ? AND active = 1
    ORDER BY agency_name ASC
    `,
    [branchId],
  );
  return rows;
}

export async function insertPartnerAgency(branchId, payload) {
  const [result] = await pool.query(
    `
    INSERT INTO partner_agency (
      branch_id,
      agency_name,
      contact_person,
      contact_number,
      email,
      active
    ) VALUES (?, ?, ?, ?, ?, 1)
    `,
    [
      branchId,
      payload.agencyName,
      payload.contactPerson,
      payload.contactNumber,
      payload.email,
    ],
  );
  return getPartnerAgencyById(result.insertId, branchId);
}

export async function getPartnerAgencyById(id, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      branch_id,
      agency_name,
      contact_person,
      contact_number,
      email,
      active
    FROM partner_agency
    WHERE id = ? AND branch_id = ?
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function updatePartnerAgencyById(id, branchId, payload) {
  const [result] = await pool.query(
    `
    UPDATE partner_agency SET
      agency_name = ?,
      contact_person = ?,
      contact_number = ?,
      email = ?
    WHERE id = ? AND branch_id = ? AND active = 1
    `,
    [payload.agencyName, payload.contactPerson, payload.contactNumber, payload.email, id, branchId],
  );
  return result.affectedRows;
}

// Soft delete: keep record but hide from lists.
export async function deactivatePartnerAgencyById(id, branchId) {
  const [result] = await pool.query(
    `
    UPDATE partner_agency SET active = 0
    WHERE id = ? AND branch_id = ? AND active = 1
    `,
    [id, branchId],
  );
  return result.affectedRows;
}
