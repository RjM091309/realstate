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
      b.partner_agency_id,
      tp.full_name AS tenant_name,
      lp.full_name AS landlord_name,
      pa.agency_name AS partner_agency_name
    FROM blacklist_record b
    LEFT JOIN tenant_profile tp ON tp.id = b.tenant_id
    LEFT JOIN landlord_profile lp ON lp.id = b.landlord_id
    LEFT JOIN partner_agency pa ON pa.id = b.partner_agency_id
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
      b.partner_agency_id,
      tp.full_name AS tenant_name,
      lp.full_name AS landlord_name,
      pa.agency_name AS partner_agency_name
    FROM blacklist_record b
    LEFT JOIN tenant_profile tp ON tp.id = b.tenant_id
    LEFT JOIN landlord_profile lp ON lp.id = b.landlord_id
    LEFT JOIN partner_agency pa ON pa.id = b.partner_agency_id
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
      partner_agency_id,
      reason,
      details,
      is_active,
      tagged_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `,
    [
      branchId,
      payload.entityType,
      payload.tenantId,
      payload.landlordId,
      payload.partnerAgencyId,
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

/** Deactivate tenant blacklist rows and clear tenant_profile flags (same idea as broker partner_agency). */
export async function clearTenantBlacklistState(branchId, tenantId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `
      UPDATE blacklist_record
      SET is_active = 0
      WHERE branch_id = ? AND entity_type = 'tenant' AND tenant_id = ? AND is_active = 1
      `,
      [branchId, tenantId],
    );
    await conn.query(
      `
      UPDATE tenant_profile
      SET is_blacklisted = 0, blacklist_reason = NULL
      WHERE id = ? AND branch_id = ?
      `,
      [tenantId, branchId],
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function deactivateBlacklistForPartnerAgency(branchId, partnerAgencyId) {
  const [result] = await pool.query(
    `
    UPDATE blacklist_record
    SET is_active = 0
    WHERE branch_id = ? AND entity_type = 'broker' AND partner_agency_id = ? AND is_active = 1
    `,
    [branchId, partnerAgencyId],
  );
  return result.affectedRows;
}

/** Match tenant flow: upsert active broker row in blacklist_record only (profile is updated by partner_agency UPDATE). */
export async function upsertActiveBrokerBlacklistRecord(branchId, partnerAgencyId, reason, taggedBy) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existingRows] = await conn.query(
      `
      SELECT id
      FROM blacklist_record
      WHERE branch_id = ? AND entity_type = 'broker' AND partner_agency_id = ? AND is_active = 1
      LIMIT 1
      FOR UPDATE
      `,
      [branchId, partnerAgencyId],
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
          partner_agency_id,
          reason,
          details,
          is_active,
          tagged_by
        ) VALUES (?, 'broker', NULL, NULL, ?, ?, NULL, 1, ?)
        `,
        [branchId, partnerAgencyId, reason, taggedBy],
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

/** Deactivate blacklist rows and clear partner_agency.is_blacklisted + reason (e.g. “activate again”). */
export async function clearBrokerBlacklistState(branchId, partnerAgencyId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `
      UPDATE blacklist_record
      SET is_active = 0
      WHERE branch_id = ? AND entity_type = 'broker' AND partner_agency_id = ? AND is_active = 1
      `,
      [branchId, partnerAgencyId],
    );
    await conn.query(
      `
      UPDATE partner_agency
      SET is_blacklisted = 0, blacklist_reason = NULL
      WHERE id = ? AND branch_id = ?
      `,
      [partnerAgencyId, branchId],
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * From POST /api/blacklist (broker): keep partner_agency flags in sync with tenant_profile pattern.
 */
export async function tagBrokerPartnerAgencyBlacklist(branchId, partnerAgencyId, reason, taggedBy) {
  const conn = await pool.getConnection();
  let recordId;
  try {
    await conn.beginTransaction();
    const [existingRows] = await conn.query(
      `
      SELECT id
      FROM blacklist_record
      WHERE branch_id = ? AND entity_type = 'broker' AND partner_agency_id = ? AND is_active = 1
      LIMIT 1
      FOR UPDATE
      `,
      [branchId, partnerAgencyId],
    );
    if (existingRows.length) {
      recordId = existingRows[0].id;
      await conn.query(
        `
        UPDATE blacklist_record
        SET reason = ?, tagged_by = ?, tagged_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [reason, taggedBy, recordId],
      );
    } else {
      const [ins] = await conn.query(
        `
        INSERT INTO blacklist_record (
          branch_id,
          entity_type,
          tenant_id,
          landlord_id,
          partner_agency_id,
          reason,
          details,
          is_active,
          tagged_by
        ) VALUES (?, 'broker', NULL, NULL, ?, ?, NULL, 1, ?)
        `,
        [branchId, partnerAgencyId, reason, taggedBy],
      );
      recordId = ins.insertId;
    }
    await conn.query(
      `
      UPDATE partner_agency
      SET is_blacklisted = 1, blacklist_reason = ?
      WHERE id = ? AND branch_id = ?
      `,
      [reason, partnerAgencyId, branchId],
    );
    await conn.commit();
    return recordId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
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
