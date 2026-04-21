import { pool } from '../config/db.js';

export async function listActiveBlacklistByBranch(branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      b.id,
      b.branch_id,
      b.entity_type,
      b.reason,
      b.details,
      b.tagged_by,
      b.tagged_at,
      b.tenant_id,
      b.landlord_id,
      tp.full_name AS tenant_name,
      lp.full_name AS landlord_name
    FROM blacklist_record b
    LEFT JOIN tenant_profile tp ON tp.id = b.tenant_id
    LEFT JOIN landlord_profile lp ON lp.id = b.landlord_id
    WHERE b.branch_id = ? AND b.is_active = 1
    ORDER BY b.tagged_at DESC
    `,
    [branchId],
  );
  return rows;
}

export async function getBlacklistRowById(id, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      b.id,
      b.branch_id,
      b.entity_type,
      b.reason,
      b.details,
      b.tagged_by,
      b.tagged_at,
      b.tenant_id,
      b.landlord_id,
      tp.full_name AS tenant_name,
      lp.full_name AS landlord_name
    FROM blacklist_record b
    LEFT JOIN tenant_profile tp ON tp.id = b.tenant_id
    LEFT JOIN landlord_profile lp ON lp.id = b.landlord_id
    WHERE b.id = ? AND b.branch_id = ?
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function insertBlacklistRecord(branchId, payload) {
  const [result] = await pool.query(
    `
    INSERT INTO blacklist_record (
      branch_id,
      entity_type,
      tenant_id,
      landlord_id,
      reason,
      details,
      is_active,
      tagged_by
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `,
    [
      branchId,
      payload.entityType,
      payload.tenantId,
      payload.landlordId,
      payload.reason,
      payload.details,
      payload.taggedBy,
    ],
  );
  return result.insertId;
}

export async function deactivateBlacklistForTenant(branchId, tenantId) {
  const [result] = await pool.query(
    `
    UPDATE blacklist_record
    SET is_active = 0
    WHERE branch_id = ? AND entity_type = 'tenant' AND tenant_id = ? AND is_active = 1
    `,
    [branchId, tenantId],
  );
  return result.affectedRows;
}

export async function upsertActiveTenantBlacklist(branchId, tenantId, reason, taggedBy) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existingRows] = await conn.query(
      `
      SELECT id
      FROM blacklist_record
      WHERE branch_id = ? AND entity_type = 'tenant' AND tenant_id = ? AND is_active = 1
      LIMIT 1
      FOR UPDATE
      `,
      [branchId, tenantId],
    );
    if (existingRows.length) {
      await conn.query(
        `
        UPDATE blacklist_record
        SET reason = ?, tagged_by = ?, tagged_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [reason, taggedBy, existingRows[0].id],
      );
    } else {
      await conn.query(
        `
        INSERT INTO blacklist_record (
          branch_id,
          entity_type,
          tenant_id,
          landlord_id,
          reason,
          details,
          is_active,
          tagged_by
        ) VALUES (?, 'tenant', ?, NULL, ?, NULL, 1, ?)
        `,
        [branchId, tenantId, reason, taggedBy],
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
