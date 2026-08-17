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

export async function listSpecialRequestsByBranch(branchId) {
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
      sr.vendor_id,
      sr.scheduled_date,
      sr.estimated_cost,
      sr.actual_cost,
      sr.resolved_at,
      sr.created_by,
      sr.created_at,
      sr.updated_at,
      lc.contract_no,
      u.unit_no AS unit_number,
      u.tower AS unit_tower,
      pr.name AS building_name,
      t.full_name AS tenant_name,
      v.name AS vendor_name
    FROM special_request sr
    INNER JOIN lease_contract lc ON lc.id = sr.contract_id AND lc.branch_id = sr.branch_id
    INNER JOIN unit u ON u.id = lc.unit_id
    INNER JOIN property pr ON pr.id = u.property_id AND pr.branch_id = sr.branch_id
    LEFT JOIN contract_tenant ct ON ct.contract_id = lc.id AND ct.is_primary = 1 AND ct.active = 1
    LEFT JOIN tenant_profile t ON t.id = ct.tenant_id
    LEFT JOIN vendor v ON v.id = sr.vendor_id
    WHERE sr.branch_id = ?
    ORDER BY sr.created_at DESC, sr.id DESC
    `,
    [branchId],
  );
  return rows;
}

export async function updateSpecialRequestStatus(id, branchId, status) {
  const resolvedAtSql = status === 'resolved' ? 'resolved_at = NOW()' : 'resolved_at = resolved_at';
  const [result] = await pool.query(
    `
    UPDATE special_request
    SET status = ?, ${resolvedAtSql}, updated_at = NOW()
    WHERE id = ? AND branch_id = ?
    `,
    [status, id, branchId],
  );
  return result.affectedRows;
}

/** Assign/clear a vendor, record estimated/actual repair cost, and/or set the scheduled work date for a ticket. */
export async function updateSpecialRequestCosts(id, branchId, payload) {
  const [result] = await pool.query(
    `
    UPDATE special_request
    SET vendor_id = ?, estimated_cost = ?, actual_cost = ?, scheduled_date = ?, updated_at = NOW()
    WHERE id = ? AND branch_id = ?
    `,
    [
      payload.vendorId ?? null,
      payload.estimatedCost ?? null,
      payload.actualCost ?? null,
      payload.scheduledDate ?? null,
      id,
      branchId,
    ],
  );
  return result.affectedRows;
}

export async function getSpecialRequestById(id, branchId) {
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
      sr.vendor_id,
      sr.scheduled_date,
      sr.estimated_cost,
      sr.actual_cost,
      sr.resolved_at,
      sr.created_by,
      sr.created_at,
      sr.updated_at,
      lc.contract_no,
      u.unit_no AS unit_number,
      u.tower AS unit_tower,
      pr.name AS building_name,
      t.full_name AS tenant_name,
      v.name AS vendor_name
    FROM special_request sr
    INNER JOIN lease_contract lc ON lc.id = sr.contract_id AND lc.branch_id = sr.branch_id
    INNER JOIN unit u ON u.id = lc.unit_id
    INNER JOIN property pr ON pr.id = u.property_id AND pr.branch_id = sr.branch_id
    LEFT JOIN contract_tenant ct ON ct.contract_id = lc.id AND ct.is_primary = 1 AND ct.active = 1
    LEFT JOIN tenant_profile t ON t.id = ct.tenant_id
    LEFT JOIN vendor v ON v.id = sr.vendor_id
    WHERE sr.id = ? AND sr.branch_id = ?
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
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

