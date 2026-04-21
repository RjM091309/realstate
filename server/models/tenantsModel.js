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
    WHERE (t.branch_id = ? OR t.branch_id IS NULL)
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
      branch_id = IFNULL(branch_id, ?),
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
    WHERE id = ? AND (branch_id <=> ? OR branch_id IS NULL)
    `,
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
    WHERE t.id = ? AND (t.branch_id <=> ? OR t.branch_id IS NULL)
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function deleteTenantById(id, branchId) {
  const [result] = await pool.query(
    'DELETE FROM tenant_profile WHERE id = ? AND (branch_id <=> ? OR branch_id IS NULL)',
    [id, branchId],
  );
  return result.affectedRows;
}

export async function updateTenantKycDocumentById(id, branchId, idImageUrl) {
  const [result] = await pool.query(
    'UPDATE tenant_profile SET id_image_url = ? WHERE id = ? AND branch_id = ?',
    [idImageUrl, id, branchId],
  );
  return result.affectedRows;
}

export async function insertTenantDocument(branchId, tenantId, doc) {
  const [result] = await pool.query(
    `
    INSERT INTO tenant_document (
      branch_id,
      tenant_id,
      document_type,
      document_no,
      expiry_date,
      file_path
    ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      branchId,
      tenantId,
      doc.documentType ?? 'other',
      doc.documentNo ?? null,
      doc.expiryDate ?? null,
      doc.filePath,
    ],
  );
  return result.insertId;
}

export async function listRepositoryDocumentsForPortal(tenantId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT dr.id, dr.title, dr.file_path, dr.doc_type
    FROM document_repository dr
    WHERE dr.branch_id = ?
      AND dr.is_portal_visible = 1
      AND (
        dr.tenant_id = ?
        OR dr.contract_id IN (
          SELECT ct.contract_id FROM contract_tenant ct WHERE ct.tenant_id = ?
        )
      )
    ORDER BY dr.created_at DESC
    `,
    [branchId, tenantId, tenantId],
  );
  return rows;
}

export async function listTenantAttachmentDocumentsForPortal(tenantId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT id, document_type, file_path, created_at
    FROM tenant_document
    WHERE tenant_id = ?
      AND branch_id = ?
      AND document_type IN ('contract_attachment', 'other')
    ORDER BY created_at DESC
    `,
    [tenantId, branchId],
  );
  return rows;
}

export async function getPrimaryContractIdForTenant(tenantId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT lc.id
    FROM lease_contract lc
    INNER JOIN contract_tenant ct ON ct.contract_id = lc.id AND ct.tenant_id = ?
    WHERE lc.branch_id = ?
    ORDER BY (lc.status = 'active') DESC, lc.end_date DESC
    LIMIT 1
    `,
    [tenantId, branchId],
  );
  return rows[0]?.id ?? null;
}
