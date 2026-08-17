import { pool } from '../config/db.js';

export const DEFAULT_CHECKLIST_ITEMS = [
  { key: 'doors_locks', label: 'Doors & Locks' },
  { key: 'walls_ceiling', label: 'Walls & Ceiling' },
  { key: 'windows', label: 'Windows' },
  { key: 'lights', label: 'Lights' },
  { key: 'electrical_outlets', label: 'Electrical Outlets' },
  { key: 'air_conditioning', label: 'Air Conditioning' },
  { key: 'water_supply', label: 'Water Supply' },
  { key: 'bathroom_fixtures', label: 'Bathroom Fixtures' },
  { key: 'kitchen_fixtures', label: 'Kitchen Fixtures' },
  { key: 'smoke_detector', label: 'Smoke Detector' },
  { key: 'internet_connection', label: 'Internet Connection' },
];

export const DEFAULT_INVENTORY_ITEMS = [
  { key: 'aircon', label: 'Aircon' },
  { key: 'refrigerator', label: 'Refrigerator' },
  { key: 'bed', label: 'Bed' },
  { key: 'sofa', label: 'Sofa' },
  { key: 'television', label: 'Television' },
  { key: 'washing_machine', label: 'Washing Machine' },
  { key: 'dining_table', label: 'Dining Table' },
  { key: 'curtains', label: 'Curtains' },
];

export const REQUIRED_PHOTO_SECTIONS = ['living_room', 'bedroom', 'kitchen', 'bathroom'];

function fmtDate(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDateTime(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d.replace('T', ' ').slice(0, 19);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export async function getInspectionByContractId(contractId, branchId) {
  const [rows] = await pool.query(
    `SELECT * FROM unit_inspection WHERE contract_id = ? AND branch_id = ? AND active = 1 LIMIT 1`,
    [contractId, branchId],
  );
  return rows[0] ?? null;
}

const APPROVED_INSPECTION_STATUSES = new Set([
  'ready_for_occupancy',
  'move_in_scheduled',
  'occupied',
]);

export function isInspectionApprovedStatus(status) {
  return APPROVED_INSPECTION_STATUSES.has(String(status ?? ''));
}

export async function isContractInspectionApproved(contractId, branchId) {
  const row = await getInspectionByContractId(contractId, branchId);
  return Boolean(row && isInspectionApprovedStatus(row.status));
}

export async function getInspectionById(id, branchId) {
  const [rows] = await pool.query(
    `SELECT * FROM unit_inspection WHERE id = ? AND branch_id = ? AND active = 1 LIMIT 1`,
    [id, branchId],
  );
  return rows[0] ?? null;
}

/** Branch-wide inspections with a scheduled date — drives the auto-generated Calendar "Inspection" event. */
export async function listInspectionsByBranch(branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      ui.id,
      ui.contract_id,
      ui.unit_id,
      ui.status,
      ui.scheduled_move_in,
      lc.contract_no,
      u.unit_no AS unit_number,
      u.tower AS unit_tower,
      pr.name AS building_name,
      t.full_name AS tenant_name
    FROM unit_inspection ui
    INNER JOIN lease_contract lc ON lc.id = ui.contract_id AND lc.branch_id = ui.branch_id
    INNER JOIN unit u ON u.id = ui.unit_id
    INNER JOIN property pr ON pr.id = u.property_id AND pr.branch_id = ui.branch_id
    LEFT JOIN contract_tenant ct ON ct.contract_id = lc.id AND ct.is_primary = 1 AND ct.active = 1
    LEFT JOIN tenant_profile t ON t.id = ct.tenant_id
    WHERE ui.branch_id = ? AND ui.active = 1 AND ui.scheduled_move_in IS NOT NULL
    ORDER BY ui.scheduled_move_in ASC, ui.id ASC
    `,
    [branchId],
  );
  return rows;
}

export async function listChecklistItems(inspectionId) {
  const [rows] = await pool.query(
    `SELECT * FROM inspection_checklist WHERE inspection_id = ? ORDER BY sort_order ASC, id ASC`,
    [inspectionId],
  );
  return rows;
}

export async function listInventoryVerifications(inspectionId) {
  const [rows] = await pool.query(
    `SELECT * FROM inventory_verification WHERE inspection_id = ? ORDER BY sort_order ASC, id ASC`,
    [inspectionId],
  );
  return rows;
}

export async function listInspectionPhotos(inspectionId) {
  const [rows] = await pool.query(
    `SELECT * FROM inspection_photo WHERE inspection_id = ? AND active = 1 ORDER BY created_at ASC, id ASC`,
    [inspectionId],
  );
  return rows;
}

export async function listInspectionLogs(inspectionId) {
  const [rows] = await pool.query(
    `SELECT * FROM inspection_log WHERE inspection_id = ? ORDER BY created_at DESC, id DESC`,
    [inspectionId],
  );
  return rows;
}

async function seedChecklistItems(inspectionId) {
  for (let i = 0; i < DEFAULT_CHECKLIST_ITEMS.length; i += 1) {
    const item = DEFAULT_CHECKLIST_ITEMS[i];
    await pool.query(
      `INSERT INTO inspection_checklist (inspection_id, item_key, item_label, sort_order)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE item_label = VALUES(item_label)`,
      [inspectionId, item.key, item.label, i + 1],
    );
  }
}

async function seedInventoryItems(inspectionId) {
  for (let i = 0; i < DEFAULT_INVENTORY_ITEMS.length; i += 1) {
    const item = DEFAULT_INVENTORY_ITEMS[i];
    await pool.query(
      `INSERT INTO inventory_verification (inspection_id, item_key, item_label, sort_order)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE item_label = VALUES(item_label)`,
      [inspectionId, item.key, item.label, i + 1],
    );
  }
}

export async function insertInspectionLog(inspectionId, eventType, message, actorUserId = null) {
  await pool.query(
    `INSERT INTO inspection_log (inspection_id, event_type, message, actor_user_id) VALUES (?, ?, ?, ?)`,
    [inspectionId, eventType, message, actorUserId],
  );
}

export async function computeChecklistScore(inspectionId) {
  const [rows] = await pool.query(
    `SELECT result FROM inspection_checklist WHERE inspection_id = ?`,
    [inspectionId],
  );
  const total = rows.length;
  if (total === 0) return 0;
  const completed = rows.filter((r) => r.result === 'pass' || r.result === 'fail').length;
  return Math.round((completed / total) * 10000) / 100;
}

export async function computeInventoryCompletion(inspectionId) {
  const [rows] = await pool.query(
    `SELECT condition_state FROM inventory_verification WHERE inspection_id = ?`,
    [inspectionId],
  );
  const total = rows.length;
  if (total === 0) return 0;
  const completed = rows.filter((r) => r.condition_state !== 'pending').length;
  return Math.round((completed / total) * 10000) / 100;
}

export async function computePhotosComplete(inspectionId) {
  const [rows] = await pool.query(
    `SELECT section FROM inspection_photo WHERE inspection_id = ? AND active = 1`,
    [inspectionId],
  );
  const sections = new Set(rows.map((r) => String(r.section)));
  return REQUIRED_PHOTO_SECTIONS.every((s) => sections.has(s)) ? 1 : 0;
}

export async function refreshInspectionMetrics(inspectionId) {
  const checklistScore = await computeChecklistScore(inspectionId);
  const inventoryCompletion = await computeInventoryCompletion(inspectionId);
  const photosComplete = await computePhotosComplete(inspectionId);
  await pool.query(
    `UPDATE unit_inspection
     SET checklist_score = ?, inventory_completion = ?, photos_complete = ?, updated_at = NOW()
     WHERE id = ?`,
    [checklistScore, inventoryCompletion, photosComplete, inspectionId],
  );
  return { checklistScore, inventoryCompletion, photosComplete: Boolean(photosComplete) };
}

export async function createOrGetInspection({ branchId, contractId, unitId, actorUserId }) {
  const existing = await getInspectionByContractId(contractId, branchId);
  if (existing) return existing;

  const [result] = await pool.query(
    `INSERT INTO unit_inspection (branch_id, contract_id, unit_id, status, workflow_step)
     VALUES (?, ?, ?, 'vacant', 'overview')`,
    [branchId, contractId, unitId],
  );
  const inspectionId = result.insertId;
  await seedChecklistItems(inspectionId);
  await seedInventoryItems(inspectionId);
  await insertInspectionLog(inspectionId, 'inspection_created', 'Inspection record created.', actorUserId);
  return getInspectionById(inspectionId, branchId);
}

export async function startInspection(inspectionId, branchId, actorUserId) {
  await pool.query(
    `UPDATE unit_inspection
     SET status = 'under_inspection', workflow_step = 'checklist', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
     WHERE id = ? AND branch_id = ? AND active = 1`,
    [inspectionId, branchId],
  );
  await insertInspectionLog(inspectionId, 'inspection_started', 'Inspection started.', actorUserId);
  return getInspectionById(inspectionId, branchId);
}

export async function updateChecklistItem(inspectionId, itemId, payload) {
  const fields = [];
  const values = [];
  if (payload.result != null) {
    fields.push('result = ?');
    values.push(payload.result);
  }
  if (payload.remarks !== undefined) {
    fields.push('remarks = ?');
    values.push(payload.remarks);
  }
  if (payload.photoDataUrl !== undefined) {
    fields.push('photo_data_url = ?');
    values.push(payload.photoDataUrl);
  }
  if (fields.length === 0) return;
  values.push(itemId, inspectionId);
  await pool.query(
    `UPDATE inspection_checklist SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND inspection_id = ?`,
    values,
  );
}

export async function updateInventoryVerification(inspectionId, itemId, payload) {
  const fields = [];
  const values = [];
  if (payload.conditionState != null) {
    fields.push('condition_state = ?');
    values.push(payload.conditionState);
  }
  if (payload.quantity != null) {
    fields.push('quantity = ?');
    values.push(payload.quantity);
  }
  if (payload.remarks !== undefined) {
    fields.push('remarks = ?');
    values.push(payload.remarks);
  }
  if (fields.length === 0) return;
  values.push(itemId, inspectionId);
  await pool.query(
    `UPDATE inventory_verification SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND inspection_id = ?`,
    values,
  );
}

export async function insertInspectionPhoto(inspectionId, section, photoDataUrl, caption = null) {
  const [result] = await pool.query(
    `INSERT INTO inspection_photo (inspection_id, section, photo_data_url, caption) VALUES (?, ?, ?, ?)`,
    [inspectionId, section, photoDataUrl, caption],
  );
  const [rows] = await pool.query(`SELECT * FROM inspection_photo WHERE id = ?`, [result.insertId]);
  return rows[0] ?? null;
}

export async function deleteInspectionPhoto(inspectionId, photoId) {
  await pool.query(
    `UPDATE inspection_photo SET active = 0 WHERE id = ? AND inspection_id = ?`,
    [photoId, inspectionId],
  );
}

export async function updateInspectionFields(inspectionId, branchId, payload) {
  const fields = [];
  const values = [];
  if (payload.workflowStep != null) {
    fields.push('workflow_step = ?');
    values.push(payload.workflowStep);
  }
  if (payload.inspectorRemarks !== undefined) {
    fields.push('inspector_remarks = ?');
    values.push(payload.inspectorRemarks);
  }
  if (payload.scheduledMoveIn !== undefined) {
    fields.push('scheduled_move_in = ?');
    values.push(payload.scheduledMoveIn || null);
  }
  if (payload.status != null) {
    fields.push('status = ?');
    values.push(payload.status);
  }
  if (fields.length === 0) return getInspectionById(inspectionId, branchId);
  values.push(inspectionId, branchId);
  await pool.query(
    `UPDATE unit_inspection SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND branch_id = ? AND active = 1`,
    values,
  );
  return getInspectionById(inspectionId, branchId);
}

export async function approveInspection(inspectionId, branchId, actorUserId) {
  await pool.query(
    `UPDATE unit_inspection
     SET status = 'ready_for_occupancy', workflow_step = 'ready', approved_at = NOW(), approved_by = ?, failed_at = NULL, updated_at = NOW()
     WHERE id = ? AND branch_id = ? AND active = 1`,
    [actorUserId, inspectionId, branchId],
  );
  await insertInspectionLog(inspectionId, 'inspection_approved', 'Inspection approved. Unit ready for occupancy.', actorUserId);
  return getInspectionById(inspectionId, branchId);
}

export async function failInspection(inspectionId, branchId, actorUserId) {
  await pool.query(
    `UPDATE unit_inspection
     SET status = 'failed', workflow_step = 'approval', failed_at = NOW(), updated_at = NOW()
     WHERE id = ? AND branch_id = ? AND active = 1`,
    [inspectionId, branchId],
  );
  await insertInspectionLog(inspectionId, 'inspection_failed', 'Inspection failed. Unit returned to maintenance.', actorUserId);
  return getInspectionById(inspectionId, branchId);
}

export async function scheduleMoveIn(inspectionId, branchId, moveInDate, actorUserId) {
  await pool.query(
    `UPDATE unit_inspection
     SET status = 'move_in_scheduled', scheduled_move_in = ?, workflow_step = 'ready', updated_at = NOW()
     WHERE id = ? AND branch_id = ? AND active = 1`,
    [moveInDate, inspectionId, branchId],
  );
  await insertInspectionLog(
    inspectionId,
    'move_in_scheduled',
    `Move-in scheduled for ${moveInDate}.`,
    actorUserId,
  );
  return getInspectionById(inspectionId, branchId);
}

export function rowToInspection(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    contractId: String(row.contract_id),
    unitId: String(row.unit_id),
    status: String(row.status),
    workflowStep: String(row.workflow_step),
    scheduledMoveIn: row.scheduled_move_in ? fmtDate(row.scheduled_move_in) : '',
    inspectorRemarks: row.inspector_remarks ? String(row.inspector_remarks) : '',
    checklistScore: Number(row.checklist_score ?? 0),
    inventoryCompletion: Number(row.inventory_completion ?? 0),
    photosComplete: Boolean(row.photos_complete),
    startedAt: row.started_at ? fmtDateTime(row.started_at) : '',
    approvedAt: row.approved_at ? fmtDateTime(row.approved_at) : '',
    failedAt: row.failed_at ? fmtDateTime(row.failed_at) : '',
    createdAt: row.created_at ? fmtDateTime(row.created_at) : '',
    updatedAt: row.updated_at ? fmtDateTime(row.updated_at) : '',
  };
}

export function rowToChecklist(row) {
  return {
    id: String(row.id),
    itemKey: String(row.item_key),
    itemLabel: String(row.item_label),
    result: String(row.result),
    remarks: row.remarks ? String(row.remarks) : '',
    photoDataUrl: row.photo_data_url ? String(row.photo_data_url) : '',
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function rowToInventoryVerification(row) {
  return {
    id: String(row.id),
    itemKey: String(row.item_key),
    itemLabel: String(row.item_label),
    conditionState: String(row.condition_state),
    quantity: Number(row.quantity ?? 1),
    remarks: row.remarks ? String(row.remarks) : '',
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function rowToPhoto(row) {
  return {
    id: String(row.id),
    section: String(row.section),
    photoDataUrl: String(row.photo_data_url),
    caption: row.caption ? String(row.caption) : '',
    createdAt: row.created_at ? fmtDateTime(row.created_at) : '',
  };
}

export function rowToLog(row) {
  return {
    id: String(row.id),
    eventType: String(row.event_type),
    message: String(row.message),
    actorUserId: row.actor_user_id != null ? String(row.actor_user_id) : undefined,
    createdAt: row.created_at ? fmtDateTime(row.created_at) : '',
  };
}
