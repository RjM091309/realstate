import { pool } from '../config/db.js';

export async function listContractsByBranch(branchId) {
  const [rows] = await pool.query(
    `SELECT id, branch_id, unit_id, tenant_id, agent_id, start_date, end_date,
            monthly_rent, security_deposit, advance_rent, contract_type, status, remarks
     FROM lease_contract
     WHERE branch_id = ?
     ORDER BY created_at DESC`,
    [branchId],
  );
  return rows;
}

export async function insertContract(branchId, payload) {
  const [result] = await pool.query(
    `INSERT INTO lease_contract (
      branch_id, unit_id, tenant_id, agent_id, start_date, end_date,
      monthly_rent, security_deposit, advance_rent, contract_type, status, remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      branchId,
      payload.unitId,
      payload.tenantId,
      payload.agentId,
      payload.startDate,
      payload.endDate,
      payload.monthlyRent,
      payload.securityDeposit,
      payload.advanceRent,
      payload.type,
      payload.status,
      payload.remarks,
    ],
  );

  return getContractById(result.insertId, branchId);
}

export async function updateContractById(id, branchId, payload) {
  const [result] = await pool.query(
    `UPDATE lease_contract SET
      unit_id = ?, tenant_id = ?, agent_id = ?, start_date = ?, end_date = ?,
      monthly_rent = ?, security_deposit = ?, advance_rent = ?, contract_type = ?, status = ?, remarks = ?
     WHERE id = ? AND branch_id = ?`,
    [
      payload.unitId,
      payload.tenantId,
      payload.agentId,
      payload.startDate,
      payload.endDate,
      payload.monthlyRent,
      payload.securityDeposit,
      payload.advanceRent,
      payload.type,
      payload.status,
      payload.remarks,
      id,
      branchId,
    ],
  );
  return result.affectedRows;
}

export async function getContractById(id, branchId) {
  const [rows] = await pool.query(
    `SELECT id, branch_id, unit_id, tenant_id, agent_id, start_date, end_date,
            monthly_rent, security_deposit, advance_rent, contract_type, status, remarks
     FROM lease_contract
     WHERE id = ? AND branch_id = ?
     LIMIT 1`,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function deleteContractById(id, branchId) {
  const [result] = await pool.query('DELETE FROM lease_contract WHERE id = ? AND branch_id = ?', [
    id,
    branchId,
  ]);
  return result.affectedRows;
}
