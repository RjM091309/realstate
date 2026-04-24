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
      nationality,
      document_type,
      document_no,
      expiry_date,
      file_path,
      kyc_verified,
      is_blacklisted,
      blacklist_reason,
      active
    FROM partner_agency
    WHERE branch_id = ?
      AND active = 1
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
      nationality,
      document_type,
      document_no,
      expiry_date,
      file_path,
      kyc_verified,
      is_blacklisted,
      blacklist_reason,
      active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
    [
      branchId,
      payload.agencyName,
      payload.contactPerson,
      payload.contactNumber,
      payload.email,
      payload.nationality,
      payload.documentType,
      payload.documentNo,
      payload.expiryDate,
      payload.filePath,
      payload.kycVerified ? 1 : 0,
      payload.isBlacklisted ? 1 : 0,
      payload.blacklistReason,
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
      nationality,
      document_type,
      document_no,
      expiry_date,
      file_path,
      kyc_verified,
      is_blacklisted,
      blacklist_reason,
      active
    FROM partner_agency
    WHERE id = ? AND branch_id = ? AND active = 1
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
      email = ?,
      nationality = ?,
      document_type = ?,
      document_no = ?,
      expiry_date = ?,
      file_path = ?,
      kyc_verified = ?,
      is_blacklisted = ?,
      blacklist_reason = ?,
      active = ?
    WHERE id = ? AND branch_id = ? AND active = 1
    `,
    [
      payload.agencyName,
      payload.contactPerson,
      payload.contactNumber,
      payload.email,
      payload.nationality,
      payload.documentType,
      payload.documentNo,
      payload.expiryDate,
      payload.filePath,
      payload.kycVerified ? 1 : 0,
      payload.isBlacklisted ? 1 : 0,
      payload.blacklistReason,
      payload.active ? 1 : 0,
      id,
      branchId,
    ],
  );
  return result.affectedRows;
}

export async function updatePartnerAgencyDocumentPathById(id, branchId, filePath) {
  const [result] = await pool.query(
    `
    UPDATE partner_agency SET file_path = ?
    WHERE id = ? AND branch_id = ? AND active = 1
    `,
    [filePath, id, branchId],
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
