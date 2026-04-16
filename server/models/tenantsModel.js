import { pool } from '../config/db.js';

export async function listTenantsByBranch(branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      t.id,
      t.branch_id,
      t.full_name AS name,
      t.email,
      t.mobile_no AS phone,
      t.id_type,
      t.id_number,
      t.id_expiry,
      t.id_image_url,
      t.kyc_verified,
      t.is_blacklisted,
      t.blacklist_reason
    FROM tenant_profile t
    WHERE t.branch_id = ?
    ORDER BY t.full_name ASC
    `,
    [branchId],
  );
  return rows;
}

export async function insertTenant(branchId, payload) {
  const [res] = await pool.query(
    `
    INSERT INTO tenant_profile (
      branch_id,
      full_name,
      email,
      mobile_no,
      id_type,
      id_number,
      id_expiry,
      id_image_url,
      kyc_verified,
      is_blacklisted,
      blacklist_reason,
      passport_no,
      primary_id_no
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      branchId,
      payload.name,
      payload.email,
      payload.phone,
      payload.idType,
      payload.idNumber,
      payload.idExpiry,
      payload.idImageUrl,
      payload.kycVerified ? 1 : 0,
      payload.isBlacklisted ? 1 : 0,
      payload.blacklistReason,
      payload.idType === 'Passport' ? payload.idNumber : null,
      payload.idType !== 'Passport' ? payload.idNumber : null,
    ],
  );

  return getTenantById(res.insertId, branchId);
}

export async function updateTenantById(id, branchId, payload) {
  const [result] = await pool.query(
    `
    UPDATE tenant_profile SET
      full_name = ?,
      email = ?,
      mobile_no = ?,
      id_type = ?,
      id_number = ?,
      id_expiry = ?,
      id_image_url = ?,
      kyc_verified = ?,
      is_blacklisted = ?,
      blacklist_reason = ?,
      passport_no = ?,
      primary_id_no = ?
    WHERE id = ? AND branch_id = ?
    `,
    [
      payload.name,
      payload.email,
      payload.email,
      payload.phone,
      payload.idType,
      payload.idNumber,
      payload.idExpiry,
      payload.idImageUrl,
      payload.kycVerified ? 1 : 0,
      payload.isBlacklisted ? 1 : 0,
      payload.blacklistReason,
      payload.idType === 'Passport' ? payload.idNumber : null,
      payload.idType !== 'Passport' ? payload.idNumber : null,
      id,
      branchId,
    ],
  );
  return result.affectedRows;
}

export async function getTenantById(id, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      t.id,
      t.branch_id,
      t.full_name AS name,
      t.email,
      t.mobile_no AS phone,
      t.id_type,
      t.id_number,
      t.id_expiry,
      t.id_image_url,
      t.kyc_verified,
      t.is_blacklisted,
      t.blacklist_reason
    FROM tenant_profile t
    WHERE t.id = ? AND t.branch_id = ?
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function deleteTenantById(id, branchId) {
  const [result] = await pool.query('DELETE FROM tenant_profile WHERE id = ? AND branch_id = ?', [
    id,
    branchId,
  ]);
  return result.affectedRows;
}
