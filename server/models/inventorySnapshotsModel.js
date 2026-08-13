import { pool } from '../config/db.js';

/**
 * Legacy inventory-snapshot records (pre-dates the Unit Inspections feature).
 * Contract activation still accepts these as an alternative to an approved
 * unit inspection — see assertCanActivateContract in contractsController.js.
 */
export async function listInventorySnapshotsByContract(contractId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      s.id,
      s.branch_id,
      s.contract_id,
      s.snapshot_type,
      s.inspection_date,
      s.inspected_by,
      s.remarks,
      s.created_at
    FROM inventory_snapshot s
    INNER JOIN lease_contract lc ON lc.id = s.contract_id AND lc.branch_id = ?
    WHERE s.contract_id = ? AND s.branch_id = ? AND s.active = 1
    ORDER BY s.inspection_date DESC, s.id DESC
    `,
    [branchId, contractId, branchId],
  );
  return rows;
}
