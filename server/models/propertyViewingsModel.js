import { pool } from '../config/db.js';

export async function listViewingsByBranch(branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      pv.id,
      pv.branch_id,
      pv.unit_id,
      pv.prospect_name,
      pv.prospect_contact,
      pv.scheduled_at,
      pv.status,
      pv.agent_id,
      pv.notes,
      pv.created_by,
      pv.created_at,
      pv.updated_at,
      u.unit_no AS unit_number,
      u.tower AS unit_tower,
      pr.name AS building_name,
      ag.FIRSTNAME AS agent_first_name,
      ag.LASTNAME AS agent_last_name
    FROM property_viewing pv
    INNER JOIN unit u ON u.id = pv.unit_id
    INNER JOIN property pr ON pr.id = u.property_id AND pr.branch_id = pv.branch_id
    LEFT JOIN user_info ag ON ag.IDNO = pv.agent_id
    WHERE pv.branch_id = ? AND pv.active = 1
    ORDER BY pv.scheduled_at ASC, pv.id ASC
    `,
    [branchId],
  );
  return rows;
}

export async function getViewingById(id, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      pv.id,
      pv.branch_id,
      pv.unit_id,
      pv.prospect_name,
      pv.prospect_contact,
      pv.scheduled_at,
      pv.status,
      pv.agent_id,
      pv.notes,
      pv.created_by,
      pv.created_at,
      pv.updated_at,
      u.unit_no AS unit_number,
      u.tower AS unit_tower,
      pr.name AS building_name,
      ag.FIRSTNAME AS agent_first_name,
      ag.LASTNAME AS agent_last_name
    FROM property_viewing pv
    INNER JOIN unit u ON u.id = pv.unit_id
    INNER JOIN property pr ON pr.id = u.property_id AND pr.branch_id = pv.branch_id
    LEFT JOIN user_info ag ON ag.IDNO = pv.agent_id
    WHERE pv.id = ? AND pv.branch_id = ? AND pv.active = 1
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function insertViewing(branchId, payload) {
  const [result] = await pool.query(
    `
    INSERT INTO property_viewing (
      branch_id, unit_id, prospect_name, prospect_contact, scheduled_at, status, agent_id, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)
    `,
    [
      branchId,
      payload.unitId,
      payload.prospectName,
      payload.prospectContact ?? null,
      payload.scheduledAt,
      payload.agentId ?? null,
      payload.notes ?? null,
      payload.createdBy ?? null,
    ],
  );
  return getViewingById(result.insertId, branchId);
}

export async function updateViewingById(id, branchId, payload) {
  const fields = [];
  const values = [];
  if (payload.unitId != null) {
    fields.push('unit_id = ?');
    values.push(payload.unitId);
  }
  if (payload.prospectName != null) {
    fields.push('prospect_name = ?');
    values.push(payload.prospectName);
  }
  if (payload.prospectContact !== undefined) {
    fields.push('prospect_contact = ?');
    values.push(payload.prospectContact);
  }
  if (payload.scheduledAt != null) {
    fields.push('scheduled_at = ?');
    values.push(payload.scheduledAt);
  }
  if (payload.status != null) {
    fields.push('status = ?');
    values.push(payload.status);
  }
  if (payload.agentId !== undefined) {
    fields.push('agent_id = ?');
    values.push(payload.agentId);
  }
  if (payload.notes !== undefined) {
    fields.push('notes = ?');
    values.push(payload.notes);
  }
  if (fields.length === 0) return 0;
  values.push(id, branchId);
  const [result] = await pool.query(
    `UPDATE property_viewing SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND branch_id = ? AND active = 1`,
    values,
  );
  return result.affectedRows;
}

export async function deleteViewingById(id, branchId) {
  const [result] = await pool.query(
    'UPDATE property_viewing SET active = 0 WHERE id = ? AND branch_id = ? AND active = 1',
    [id, branchId],
  );
  return result.affectedRows;
}
