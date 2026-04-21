import { pool } from '../config/db.js';

export async function listCalendarEventsByBranch(branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      branch_id,
      contract_id,
      payment_schedule_id,
      event_type,
      event_date,
      title,
      color_code,
      metadata_json,
      created_at
    FROM calendar_event
    WHERE branch_id = ?
    ORDER BY event_date DESC, created_at DESC
    `,
    [branchId],
  );
  return rows;
}

export async function insertCalendarEvent(branchId, payload) {
  const [res] = await pool.query(
    `
    INSERT INTO calendar_event (
      branch_id,
      contract_id,
      payment_schedule_id,
      event_type,
      event_date,
      title,
      color_code,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      branchId,
      payload.contractId ?? null,
      payload.paymentScheduleId ?? null,
      payload.eventType,
      payload.eventDate,
      payload.title,
      payload.colorCode ?? null,
      payload.metadataJson ?? null,
    ],
  );
  return getCalendarEventById(res.insertId, branchId);
}

export async function updateCalendarEventById(id, branchId, payload) {
  const [result] = await pool.query(
    `
    UPDATE calendar_event
    SET
      contract_id = ?,
      payment_schedule_id = ?,
      event_type = ?,
      event_date = ?,
      title = ?,
      color_code = ?,
      metadata_json = ?
    WHERE id = ? AND branch_id = ?
    `,
    [
      payload.contractId ?? null,
      payload.paymentScheduleId ?? null,
      payload.eventType,
      payload.eventDate,
      payload.title,
      payload.colorCode ?? null,
      payload.metadataJson ?? null,
      id,
      branchId,
    ],
  );
  return result.affectedRows;
}

export async function getCalendarEventById(id, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      branch_id,
      contract_id,
      payment_schedule_id,
      event_type,
      event_date,
      title,
      color_code,
      metadata_json,
      created_at
    FROM calendar_event
    WHERE id = ? AND branch_id = ?
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function deleteCalendarEventById(id, branchId) {
  const [result] = await pool.query('DELETE FROM calendar_event WHERE id = ? AND branch_id = ?', [
    id,
    branchId,
  ]);
  return result.affectedRows;
}

