import { pool } from '../config/db.js';

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
    INNER JOIN lease_contract lc ON lc.id = s.contract_id AND lc.branch_id = ? AND lc.active = 1
    WHERE s.contract_id = ? AND s.branch_id = ? AND s.active = 1
    ORDER BY s.inspection_date DESC, s.id DESC
    `,
    [branchId, contractId, branchId],
  );
  return rows;
}

export async function listInventorySnapshotItems(snapshotId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      i.id,
      i.snapshot_id,
      i.item_name,
      i.category,
      i.quantity,
      i.condition_state,
      i.notes
    FROM inventory_snapshot_item i
    INNER JOIN inventory_snapshot s ON s.id = i.snapshot_id AND s.branch_id = ? AND s.active = 1
    WHERE i.snapshot_id = ? AND i.active = 1
    ORDER BY i.id ASC
    `,
    [branchId, snapshotId],
  );
  return rows;
}

export async function insertInventorySnapshot(branchId, payload) {
  const [res] = await pool.query(
    `
    INSERT INTO inventory_snapshot (
      branch_id,
      contract_id,
      snapshot_type,
      inspection_date,
      inspected_by,
      remarks
    ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      branchId,
      payload.contractId,
      payload.snapshotType,
      payload.inspectionDate,
      payload.inspectedBy ?? null,
      payload.remarks ?? null,
    ],
  );
  return res.insertId;
}

export async function insertInventorySnapshotItem(branchId, payload) {
  // Ensure snapshot belongs to branch.
  const [[snap]] = await pool.query(
    `SELECT id FROM inventory_snapshot WHERE id = ? AND branch_id = ? AND active = 1 LIMIT 1`,
    [payload.snapshotId, branchId],
  );
  if (!snap) return null;

  const [res] = await pool.query(
    `
    INSERT INTO inventory_snapshot_item (
      snapshot_id,
      item_name,
      category,
      quantity,
      condition_state,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      payload.snapshotId,
      payload.itemName,
      payload.category ?? null,
      payload.quantity ?? 1,
      payload.conditionState ?? 'good',
      payload.notes ?? null,
    ],
  );
  return res.insertId;
}

export async function updateInventorySnapshotById(branchId, snapshotId, patch) {
  // Ensure snapshot belongs to branch.
  const [[snap]] = await pool.query(
    `SELECT id, contract_id FROM inventory_snapshot WHERE id = ? AND branch_id = ? AND active = 1 LIMIT 1`,
    [snapshotId, branchId],
  );
  if (!snap) return null;

  const [res] = await pool.query(
    `
    UPDATE inventory_snapshot SET
      snapshot_type = ?,
      inspection_date = ?,
      remarks = ?
    WHERE id = ? AND branch_id = ? AND active = 1
    `,
    [patch.snapshotType, patch.inspectionDate, patch.remarks ?? null, snapshotId, branchId],
  );
  return res.affectedRows > 0 ? String(snap.contract_id) : null;
}

export async function deleteInventorySnapshotById(branchId, snapshotId) {
  const [[snap]] = await pool.query(
    `SELECT id, contract_id FROM inventory_snapshot WHERE id = ? AND branch_id = ? AND active = 1 LIMIT 1`,
    [snapshotId, branchId],
  );
  if (!snap) return null;

  await pool.query('UPDATE inventory_snapshot_item SET active = 0 WHERE snapshot_id = ? AND active = 1', [
    snapshotId,
  ]);
  const [res] = await pool.query(
    'UPDATE inventory_snapshot SET active = 0 WHERE id = ? AND branch_id = ? AND active = 1',
    [snapshotId, branchId],
  );
  return res.affectedRows > 0 ? String(snap.contract_id) : null;
}

export async function updateInventorySnapshotItemById(branchId, itemId, patch) {
  const [[row]] = await pool.query(
    `
    SELECT i.id, i.snapshot_id
    FROM inventory_snapshot_item i
    INNER JOIN inventory_snapshot s ON s.id = i.snapshot_id AND s.branch_id = ? AND s.active = 1
    WHERE i.id = ? AND i.active = 1
    LIMIT 1
    `,
    [branchId, itemId],
  );
  if (!row) return null;

  const [res] = await pool.query(
    `
    UPDATE inventory_snapshot_item SET
      item_name = ?,
      category = ?,
      quantity = ?,
      condition_state = ?,
      notes = ?
    WHERE id = ? AND active = 1
    `,
    [
      patch.itemName,
      patch.category ?? null,
      patch.quantity,
      patch.conditionState,
      patch.notes ?? null,
      itemId,
    ],
  );
  return res.affectedRows > 0 ? String(row.snapshot_id) : null;
}

export async function deleteInventorySnapshotItemById(branchId, itemId) {
  const [[row]] = await pool.query(
    `
    SELECT i.id, i.snapshot_id
    FROM inventory_snapshot_item i
    INNER JOIN inventory_snapshot s ON s.id = i.snapshot_id AND s.branch_id = ? AND s.active = 1
    WHERE i.id = ? AND i.active = 1
    LIMIT 1
    `,
    [branchId, itemId],
  );
  if (!row) return null;

  const [res] = await pool.query('UPDATE inventory_snapshot_item SET active = 0 WHERE id = ? AND active = 1', [
    itemId,
  ]);
  return res.affectedRows > 0 ? String(row.snapshot_id) : null;
}

