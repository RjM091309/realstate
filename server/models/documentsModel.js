import { pool } from '../config/db.js';

export async function listActiveTemplatesByBranch(branchId, templateKey) {
  const key = templateKey != null && String(templateKey).trim() !== '' ? String(templateKey).trim() : null;
  const [rows] = await pool.query(
    `
    SELECT
      id,
      branch_id,
      template_key,
      title,
      file_path,
      version_no,
      is_active,
      created_at
    FROM document_template
    WHERE (branch_id = ? OR branch_id IS NULL)
      AND is_active = 1
      AND (? IS NULL OR template_key = ?)
    ORDER BY template_key ASC, version_no DESC, created_at DESC
    `,
    [branchId, key, key],
  );
  return rows;
}

export async function getNextTemplateVersion(branchId, templateKey) {
  const [rows] = await pool.query(
    `
    SELECT COALESCE(MAX(version_no), 0) AS max_version
    FROM document_template
    WHERE branch_id = ? AND template_key = ?
    `,
    [branchId, templateKey],
  );
  const maxV = Number(rows?.[0]?.max_version ?? 0);
  return Number.isFinite(maxV) ? maxV + 1 : 1;
}

export async function insertDocumentTemplate(branchId, payload) {
  const [result] = await pool.query(
    `
    INSERT INTO document_template (
      branch_id,
      template_key,
      title,
      file_path,
      version_no,
      is_active,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      branchId,
      payload.templateKey,
      payload.title,
      payload.filePath,
      payload.versionNo,
      payload.isActive ? 1 : 0,
      payload.createdBy ?? null,
    ],
  );
  return result.insertId;
}

export async function listRepositoryDocumentsForContract(contractId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      dr.id,
      dr.branch_id,
      dr.contract_id,
      dr.tenant_id,
      dr.uploaded_by,
      dr.doc_type,
      dr.title,
      dr.file_path,
      dr.is_portal_visible,
      dr.created_at
    FROM document_repository dr
    WHERE dr.branch_id = ?
      AND dr.contract_id = ?
    ORDER BY dr.created_at DESC, dr.id DESC
    `,
    [branchId, contractId],
  );
  return rows;
}

export async function insertRepositoryDocument(branchId, payload) {
  const [result] = await pool.query(
    `
    INSERT INTO document_repository (
      branch_id,
      contract_id,
      tenant_id,
      uploaded_by,
      doc_type,
      title,
      file_path,
      is_portal_visible
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      branchId,
      payload.contractId ?? null,
      payload.tenantId ?? null,
      payload.uploadedBy ?? null,
      payload.docType ?? 'other',
      payload.title,
      payload.filePath,
      payload.portalVisible ? 1 : 0,
    ],
  );
  return result.insertId;
}

