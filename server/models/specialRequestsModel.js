import { pool } from '../config/db.js';

export async function listSpecialRequestsByContract(contractId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      sr.id,
      sr.branch_id,
      sr.contract_id,
      sr.request_source,
      sr.title,
      sr.details,
      sr.status,
      sr.created_by,
      sr.created_at,
      sr.updated_at
    FROM special_request sr
    INNER JOIN lease_contract lc ON lc.id = sr.contract_id AND lc.branch_id = ?
    WHERE sr.contract_id = ? AND sr.branch_id = ?
    ORDER BY sr.created_at DESC, sr.id DESC
    `,
    [branchId, contractId, branchId],
  );
  return rows;
}

export async function insertSpecialRequest(branchId, contractId, payload) {
  const [result] = await pool.query(
    `
    INSERT INTO special_request (
      branch_id,
      contract_id,
      request_source,
      title,
      details,
      status,
      created_by
    ) VALUES (?, ?, 'tenant', ?, ?, 'open', ?)
    `,
    [branchId, contractId, payload.title, payload.details, payload.createdBy ?? null],
  );
  return result.insertId;
}

