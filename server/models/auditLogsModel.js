import { pool } from '../config/db.js';

export async function insertAuditLog(payload) {
  const [res] = await pool.query(
    `
    INSERT INTO audit_log (
      branch_id,
      actor_user_id,
      module_name,
      record_table,
      record_id,
      action,
      change_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.branchId ?? null,
      payload.actorUserId ?? null,
      payload.moduleName,
      payload.recordTable,
      payload.recordId ?? null,
      payload.action,
      payload.changeSummary ?? null,
    ],
  );
  return res.insertId;
}

export async function listAuditLogsByBranch(branchId, filters) {
  const moduleName = filters?.moduleName ? String(filters.moduleName) : null;
  const recordTable = filters?.recordTable ? String(filters.recordTable) : null;
  const actorUserId = filters?.actorUserId ? Number(filters.actorUserId) : null;
  const recordId = filters?.recordId ? String(filters.recordId).trim() : null;
  const limit = Math.min(200, Math.max(1, Number(filters?.limit ?? 100)));

  const where = ['(branch_id = ? OR branch_id IS NULL)'];
  const params = [branchId];
  if (moduleName) {
    where.push('module_name = ?');
    params.push(moduleName);
  }
  if (recordTable) {
    where.push('record_table = ?');
    params.push(recordTable);
  }
  if (Number.isFinite(actorUserId) && actorUserId > 0) {
    where.push('actor_user_id = ?');
    params.push(actorUserId);
  }
  if (recordId && /^\d+$/.test(recordId)) {
    where.push('record_id = ?');
    params.push(Number(recordId));
  }

  const [rows] = await pool.query(
    `
    SELECT
      id,
      branch_id,
      actor_user_id,
      module_name,
      record_table,
      record_id,
      action,
      change_summary,
      created_at
    FROM audit_log
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit}
    `,
    params,
  );
  return rows;
}

