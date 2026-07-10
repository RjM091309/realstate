import { pool } from '../config/db.js';

const KYC_DOC_TYPES = ['passport', 'national_id', 'visa'];

export function clientIdTypeToDocEnum(idType) {
  const s = String(idType ?? '').trim().toLowerCase();
  if (s.includes('passport')) return 'passport';
  if (s.includes('visa')) return 'visa';
  return 'national_id';
}

function kycTypesSqlList() {
  return KYC_DOC_TYPES.map(() => '?').join(', ');
}

export async function listTenantsByBranch(branchId) {
  const types = [...KYC_DOC_TYPES];
  const [rows] = await pool.query(
    `
    SELECT
      t.id,
      t.branch_id,
      t.full_name AS name,
      t.email,
      t.mobile_no AS phone,
      t.nationality,
      t.birth_date,
      CASE d.document_type
        WHEN 'passport' THEN 'Passport'
        WHEN 'national_id' THEN 'National ID'
        WHEN 'visa' THEN 'Visa'
        ELSE ''
      END AS id_type,
      d.document_no AS id_number,
      d.expiry_date AS id_expiry,
      NULLIF(TRIM(d.file_path), '') AS id_image_url,
      t.kyc_verified,
      t.is_blacklisted,
      t.blacklist_reason,
      t.created_at
    FROM tenant_profile t
    LEFT JOIN tenant_document d ON d.id = (
      SELECT MAX(d2.id)
      FROM tenant_document d2
      WHERE d2.tenant_id = t.id
        AND d2.branch_id = ?
        AND d2.document_type IN (${kycTypesSqlList()})
    )
    WHERE (t.branch_id = ? OR t.branch_id IS NULL)
      AND t.active = 1
    ORDER BY t.full_name ASC
    `,
    [branchId, ...types, branchId],
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
      nationality,
      birth_date,
      kyc_verified,
      is_blacklisted,
      blacklist_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      branchId,
      payload.name,
      payload.email,
      payload.phone,
      payload.nationality,
      payload.birthDate,
      payload.kycVerified ? 1 : 0,
      payload.isBlacklisted ? 1 : 0,
      payload.blacklistReason,
    ],
  );

  const tenantId = res.insertId;
  const hasKycMeta = String(payload.idType ?? '').trim() !== '' && String(payload.idNumber ?? '').trim() !== '';
  if (hasKycMeta) {
    await upsertPrimaryKycDocument(branchId, tenantId, payload);
  }
  return getTenantById(tenantId, branchId);
}

export async function updateTenantById(id, branchId, payload) {
  const [result] = await pool.query(
    `
    UPDATE tenant_profile SET
      branch_id = IFNULL(branch_id, ?),
      full_name = ?,
      email = ?,
      mobile_no = ?,
      nationality = ?,
      birth_date = ?,
      kyc_verified = ?,
      is_blacklisted = ?,
      blacklist_reason = ?
    WHERE id = ? AND (branch_id <=> ? OR branch_id IS NULL) AND active = 1
    `,
    [
      branchId,
      payload.name,
      payload.email,
      payload.phone,
      payload.nationality,
      payload.birthDate,
      payload.kycVerified ? 1 : 0,
      payload.isBlacklisted ? 1 : 0,
      payload.blacklistReason,
      id,
      branchId,
    ],
  );
  if (result.affectedRows === 0) return 0;
  const hasKycMeta = String(payload.idType ?? '').trim() !== '' && String(payload.idNumber ?? '').trim() !== '';
  if (hasKycMeta) {
    await upsertPrimaryKycDocument(branchId, id, payload);
  }
  return result.affectedRows;
}

export async function getTenantById(id, branchId) {
  const types = [...KYC_DOC_TYPES];
  const [rows] = await pool.query(
    `
    SELECT
      t.id,
      t.branch_id,
      t.full_name AS name,
      t.email,
      t.mobile_no AS phone,
      t.nationality,
      t.birth_date,
      CASE d.document_type
        WHEN 'passport' THEN 'Passport'
        WHEN 'national_id' THEN 'National ID'
        WHEN 'visa' THEN 'Visa'
        ELSE ''
      END AS id_type,
      d.document_no AS id_number,
      d.expiry_date AS id_expiry,
      NULLIF(TRIM(d.file_path), '') AS id_image_url,
      t.kyc_verified,
      t.is_blacklisted,
      t.blacklist_reason,
      t.created_at
    FROM tenant_profile t
    LEFT JOIN tenant_document d ON d.id = (
      SELECT MAX(d2.id)
      FROM tenant_document d2
      WHERE d2.tenant_id = t.id
        AND d2.branch_id = ?
        AND d2.document_type IN (${kycTypesSqlList()})
    )
    WHERE t.id = ? AND (t.branch_id <=> ? OR t.branch_id IS NULL) AND t.active = 1
    LIMIT 1
    `,
    [branchId, ...types, id, branchId],
  );
  return rows[0] ?? null;
}

export async function deleteTenantById(id, branchId) {
  const [result] = await pool.query(
    `UPDATE tenant_profile
     SET active = 0
     WHERE id = ? AND (branch_id <=> ? OR branch_id IS NULL) AND active = 1`,
    [id, branchId],
  );
  return result.affectedRows;
}

async function latestKycDocumentRow(tenantId, branchId) {
  const types = [...KYC_DOC_TYPES];
  const [rows] = await pool.query(
    `
    SELECT id, document_type, document_no, expiry_date, file_path
    FROM tenant_document
    WHERE tenant_id = ? AND branch_id = ? AND document_type IN (${kycTypesSqlList()})
    ORDER BY id DESC
    LIMIT 1
    `,
    [tenantId, branchId, ...types],
  );
  return rows[0] ?? null;
}

async function upsertPrimaryKycDocument(branchId, tenantId, payload) {
  const docType = clientIdTypeToDocEnum(payload.idType);
  const docNo = String(payload.idNumber ?? '').trim() || null;
  const exp = payload.idExpiry || null;
  const fpRaw = payload.idImageUrl != null ? String(payload.idImageUrl).trim() : '';
  const filePath = fpRaw || '';

  const latest = await latestKycDocumentRow(tenantId, branchId);
  if (latest) {
    const keepPath =
      filePath ||
      (latest.file_path != null && String(latest.file_path).trim() !== ''
        ? String(latest.file_path).trim()
        : '');
    await pool.query(
      `
      UPDATE tenant_document SET
        document_type = ?,
        document_no = ?,
        expiry_date = ?,
        file_path = ?
      WHERE id = ?
      `,
      [docType, docNo, exp, keepPath || '', latest.id],
    );
    return;
  }

  await pool.query(
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
    [branchId, tenantId, docType, docNo, exp, filePath || ''],
  );
}

/**
 * Attach file to KYC. If the latest passport/national_id/visa row has no file yet (e.g. CRM saved
 * metadata first then uploads), UPDATE that row so we do not duplicate the same registration.
 * If a file already exists, INSERT a new row (revision / audit trail).
 */
export async function insertKycUploadRevision(branchId, tenantId, publicUrl) {
  const latest = await latestKycDocumentRow(tenantId, branchId);
  const latestFp = latest?.file_path != null ? String(latest.file_path).trim() : '';

  if (latest && latestFp === '') {
    await pool.query(`UPDATE tenant_document SET file_path = ? WHERE id = ?`, [publicUrl, latest.id]);
    return latest.id;
  }

  return insertTenantDocument(branchId, tenantId, {
    documentType: latest?.document_type ?? 'passport',
    documentNo: latest?.document_no ?? null,
    expiryDate: latest?.expiry_date ?? null,
    filePath: publicUrl,
  });
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
          SELECT ct.contract_id FROM contract_tenant ct WHERE ct.tenant_id = ? AND ct.active = 1
        )
      )
    ORDER BY dr.created_at DESC
    `,
    [branchId, tenantId, tenantId],
  );
  return rows;
}

export async function getLatestLeaseContractRepositoryDocForTenant(tenantId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT dr.id, dr.title, dr.file_path, dr.created_at
    FROM document_repository dr
    WHERE dr.branch_id = ?
      AND dr.tenant_id = ?
      AND dr.doc_type = 'lease_contract'
    ORDER BY dr.created_at DESC, dr.id DESC
    LIMIT 1
    `,
    [branchId, tenantId],
  );
  return rows[0] ?? null;
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
    INNER JOIN contract_tenant ct ON ct.contract_id = lc.id AND ct.tenant_id = ? AND ct.active = 1
    WHERE lc.branch_id = ? AND lc.active = 1
    ORDER BY (lc.status = 'active') DESC, lc.end_date DESC
    LIMIT 1
    `,
    [tenantId, branchId],
  );
  return rows[0]?.id ?? null;
}
