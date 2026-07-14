import { pool } from '../config/db.js';

const KYC_DOC_TYPES = ['passport', 'national_id', 'visa'];

function normalizeEmail(value) {
  const s = String(value ?? '').trim().toLowerCase();
  return s || null;
}

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits || null;
}

function normalizeGovernmentId(value) {
  const s = String(value ?? '').trim().toUpperCase();
  return s || null;
}

async function fetchTenantContact(branchId, tenantId) {
  const types = [...KYC_DOC_TYPES];
  const [rows] = await pool.query(
    `
    SELECT
      t.full_name AS name,
      t.email,
      t.mobile_no AS phone,
      d.document_no AS government_id
    FROM tenant_profile t
    LEFT JOIN tenant_document d ON d.id = (
      SELECT MAX(d2.id)
      FROM tenant_document d2
      WHERE d2.tenant_id = t.id
        AND d2.branch_id = ?
        AND d2.document_type IN (${types.map(() => '?').join(', ')})
    )
    WHERE t.id = ? AND (t.branch_id = ? OR t.branch_id IS NULL)
    LIMIT 1
    `,
    [branchId, ...types, tenantId, branchId],
  );
  return rows[0] ?? null;
}

async function fetchBrokerContact(branchId, partnerAgencyId) {
  const [rows] = await pool.query(
    `
    SELECT
      agency_name AS name,
      email,
      contact_number AS phone,
      document_no AS government_id
    FROM partner_agency
    WHERE id = ? AND branch_id = ?
    LIMIT 1
    `,
    [partnerAgencyId, branchId],
  );
  return rows[0] ?? null;
}

export async function listBlacklistByBranch(branchId, { type = 'all', search = '' } = {}) {
  const params = [branchId];
  let typeClause = '';
  if (type === 'tenant' || type === 'broker') {
    typeClause = ' AND b.entity_type = ?';
    params.push(type);
  }

  const q = String(search ?? '').trim().toLowerCase();
  let searchClause = '';
  if (q) {
    const like = `%${q}%`;
    searchClause = `
      AND (
        LOWER(b.name) LIKE ?
        OR LOWER(COALESCE(b.email, '')) LIKE ?
        OR LOWER(COALESCE(b.phone, '')) LIKE ?
        OR LOWER(COALESCE(b.government_id, '')) LIKE ?
        OR LOWER(b.reason) LIKE ?
      )
    `;
    params.push(like, like, like, like, like);
  }

  const [rows] = await pool.query(
    `
    SELECT
      b.id,
      b.branch_id,
      b.entity_type,
      b.name,
      b.email,
      b.phone,
      b.government_id,
      b.reason,
      b.blacklisted_by,
      b.tenant_id,
      b.partner_agency_id,
      b.created_at,
      b.updated_at,
      u.FIRSTNAME AS blacklisted_by_first_name,
      u.LASTNAME AS blacklisted_by_last_name
    FROM blacklist b
    LEFT JOIN user_info u ON u.IDNO = b.blacklisted_by
    WHERE b.branch_id = ? AND b.is_active = 1
    ${typeClause}
    ${searchClause}
    ORDER BY b.created_at DESC
    `,
    params,
  );
  return rows;
}

export async function getBlacklistById(id, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      b.id,
      b.branch_id,
      b.entity_type,
      b.name,
      b.email,
      b.phone,
      b.government_id,
      b.reason,
      b.blacklisted_by,
      b.tenant_id,
      b.partner_agency_id,
      b.created_at,
      b.updated_at,
      u.FIRSTNAME AS blacklisted_by_first_name,
      u.LASTNAME AS blacklisted_by_last_name
    FROM blacklist b
    LEFT JOIN user_info u ON u.IDNO = b.blacklisted_by
    WHERE b.id = ? AND b.branch_id = ? AND b.is_active = 1
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function insertBlacklistEntry(branchId, payload) {
  const [result] = await pool.query(
    `
    INSERT INTO blacklist (
      branch_id,
      entity_type,
      name,
      email,
      phone,
      government_id,
      reason,
      blacklisted_by,
      tenant_id,
      partner_agency_id,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
    [
      branchId,
      payload.entityType,
      payload.name,
      payload.email,
      payload.phone,
      payload.governmentId,
      payload.reason,
      payload.blacklistedBy,
      payload.tenantId,
      payload.partnerAgencyId,
    ],
  );
  return result.insertId;
}

export async function deactivateBlacklistById(id, branchId) {
  const row = await getBlacklistById(id, branchId);
  if (!row) return false;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE blacklist SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND branch_id = ?`,
      [id, branchId],
    );

    if (row.tenant_id != null) {
      await conn.query(
        `
        UPDATE tenant_profile
        SET is_blacklisted = 0, blacklist_reason = NULL
        WHERE id = ? AND (branch_id = ? OR branch_id IS NULL)
        `,
        [row.tenant_id, branchId],
      );
      await conn.query(
        `
        UPDATE blacklist_record
        SET is_active = 0
        WHERE branch_id = ? AND entity_type = 'tenant' AND tenant_id = ? AND is_active = 1
        `,
        [branchId, row.tenant_id],
      );
    }

    if (row.partner_agency_id != null) {
      await conn.query(
        `
        UPDATE partner_agency
        SET is_blacklisted = 0, blacklist_reason = NULL
        WHERE id = ? AND branch_id = ?
        `,
        [row.partner_agency_id, branchId],
      );
      await conn.query(
        `
        UPDATE blacklist_record
        SET is_active = 0
        WHERE branch_id = ? AND entity_type = 'broker' AND partner_agency_id = ? AND is_active = 1
        `,
        [branchId, row.partner_agency_id],
      );
    }

    await conn.commit();
    return true;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function checkBlacklistMatch(branchId, { email, phone, governmentId } = {}) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  const normalizedGovId = normalizeGovernmentId(governmentId);

  if (!normalizedEmail && !normalizedPhone && !normalizedGovId) return null;

  const clauses = [];
  const params = [branchId];

  if (normalizedEmail) {
    clauses.push('LOWER(TRIM(email)) = ?');
    params.push(normalizedEmail);
  }
  if (normalizedPhone) {
    clauses.push(`REPLACE(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '(', ''), ')', '') = ?`);
    params.push(normalizedPhone);
  }
  if (normalizedGovId) {
    clauses.push('UPPER(TRIM(government_id)) = ?');
    params.push(normalizedGovId);
  }

  const [rows] = await pool.query(
    `
    SELECT id, entity_type, name, email, phone, government_id, reason, created_at
    FROM blacklist
    WHERE branch_id = ? AND is_active = 1 AND (${clauses.join(' OR ')})
    ORDER BY created_at DESC
    LIMIT 1
    `,
    params,
  );
  return rows[0] ?? null;
}

async function upsertBlacklistRow(conn, branchId, payload) {
  const entityCol = payload.entityType === 'broker' ? 'partner_agency_id' : 'tenant_id';
  const entityId = payload.entityType === 'broker' ? payload.partnerAgencyId : payload.tenantId;

  const [existingRows] = await conn.query(
    `
    SELECT id
    FROM blacklist
    WHERE branch_id = ? AND entity_type = ? AND ${entityCol} = ? AND is_active = 1
    LIMIT 1
    FOR UPDATE
    `,
    [branchId, payload.entityType, entityId],
  );

  if (existingRows.length) {
    await conn.query(
      `
      UPDATE blacklist
      SET
        name = ?,
        email = ?,
        phone = ?,
        government_id = ?,
        reason = ?,
        blacklisted_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        payload.name,
        payload.email,
        payload.phone,
        payload.governmentId,
        payload.reason,
        payload.blacklistedBy,
        existingRows[0].id,
      ],
    );
    return existingRows[0].id;
  }

  const [ins] = await conn.query(
    `
    INSERT INTO blacklist (
      branch_id,
      entity_type,
      name,
      email,
      phone,
      government_id,
      reason,
      blacklisted_by,
      tenant_id,
      partner_agency_id,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
    [
      branchId,
      payload.entityType,
      payload.name,
      payload.email,
      payload.phone,
      payload.governmentId,
      payload.reason,
      payload.blacklistedBy,
      payload.entityType === 'tenant' ? entityId : null,
      payload.entityType === 'broker' ? entityId : null,
    ],
  );
  return ins.insertId;
}

async function upsertLegacyBlacklistRecord(conn, branchId, payload) {
  const entityCol =
    payload.entityType === 'broker'
      ? 'partner_agency_id'
      : payload.entityType === 'landlord'
        ? 'landlord_id'
        : 'tenant_id';
  const entityId =
    payload.entityType === 'broker'
      ? payload.partnerAgencyId
      : payload.entityType === 'landlord'
        ? payload.landlordId
        : payload.tenantId;

  const [existingRows] = await conn.query(
    `
    SELECT id
    FROM blacklist_record
    WHERE branch_id = ? AND entity_type = ? AND ${entityCol} = ? AND is_active = 1
    LIMIT 1
    FOR UPDATE
    `,
    [branchId, payload.entityType, entityId],
  );

  if (existingRows.length) {
    await conn.query(
      `
      UPDATE blacklist_record
      SET reason = ?, tagged_by = ?, tagged_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [payload.reason, payload.blacklistedBy, existingRows[0].id],
    );
    return;
  }

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
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?)
    `,
    [
      branchId,
      payload.entityType,
      payload.entityType === 'tenant' ? entityId : null,
      payload.entityType === 'landlord' ? entityId : null,
      payload.entityType === 'broker' ? entityId : null,
      payload.reason,
      payload.blacklistedBy,
    ],
  );
}

/** @deprecated use getBlacklistById */
export async function getBlacklistRowById(id, branchId) {
  return getBlacklistById(id, branchId);
}

/** @deprecated use listBlacklistByBranch */
export async function listActiveBlacklistByBranch(branchId) {
  return listBlacklistByBranch(branchId);
}

export async function insertBlacklistRecord(branchId, payload) {
  let name = payload.name;
  let email = payload.email ?? null;
  let phone = payload.phone ?? null;
  let governmentId = payload.governmentId ?? null;

  if (payload.entityType === 'tenant' && payload.tenantId) {
    const contact = await fetchTenantContact(branchId, payload.tenantId);
    if (contact) {
      name = name || contact.name;
      email = email || contact.email;
      phone = phone || contact.phone;
      governmentId = governmentId || contact.government_id;
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `
        UPDATE tenant_profile
        SET is_blacklisted = 1, blacklist_reason = ?
        WHERE id = ? AND (branch_id = ? OR branch_id IS NULL)
        `,
        [payload.reason, payload.tenantId, branchId],
      );
      const recordId = await upsertBlacklistRow(conn, branchId, {
        entityType: 'tenant',
        tenantId: payload.tenantId,
        name: name || '—',
        email: normalizeEmail(email),
        phone: phone,
        governmentId: normalizeGovernmentId(governmentId),
        reason: payload.reason,
        blacklistedBy: payload.taggedBy,
      });
      await upsertLegacyBlacklistRecord(conn, branchId, payload);
      await conn.commit();
      return recordId;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  const id = await insertBlacklistEntry(branchId, {
    entityType: payload.entityType,
    name: name || '—',
    email: normalizeEmail(email),
    phone: phone,
    governmentId: normalizeGovernmentId(governmentId),
    reason: payload.reason,
    blacklistedBy: payload.taggedBy,
    tenantId: payload.tenantId,
    partnerAgencyId: payload.partnerAgencyId,
  });
  return id;
}

export async function deactivateBlacklistForTenant(branchId, tenantId) {
  const [result] = await pool.query(
    `
    UPDATE blacklist
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE branch_id = ? AND entity_type = 'tenant' AND tenant_id = ? AND is_active = 1
    `,
    [branchId, tenantId],
  );
  await pool.query(
    `
    UPDATE blacklist_record
    SET is_active = 0
    WHERE branch_id = ? AND entity_type = 'tenant' AND tenant_id = ? AND is_active = 1
    `,
    [branchId, tenantId],
  );
  return result.affectedRows;
}

export async function clearTenantBlacklistState(branchId, tenantId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `
      UPDATE blacklist
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = ? AND entity_type = 'tenant' AND tenant_id = ? AND is_active = 1
      `,
      [branchId, tenantId],
    );
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
      WHERE id = ? AND (branch_id = ? OR branch_id IS NULL)
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
    UPDATE blacklist
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE branch_id = ? AND entity_type = 'broker' AND partner_agency_id = ? AND is_active = 1
    `,
    [branchId, partnerAgencyId],
  );
  await pool.query(
    `
    UPDATE blacklist_record
    SET is_active = 0
    WHERE branch_id = ? AND entity_type = 'broker' AND partner_agency_id = ? AND is_active = 1
    `,
    [branchId, partnerAgencyId],
  );
  return result.affectedRows;
}

export async function upsertActiveBrokerBlacklistRecord(branchId, partnerAgencyId, reason, taggedBy) {
  const contact = await fetchBrokerContact(branchId, partnerAgencyId);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await upsertBlacklistRow(conn, branchId, {
      entityType: 'broker',
      partnerAgencyId,
      name: contact?.name || '—',
      email: normalizeEmail(contact?.email),
      phone: contact?.phone ?? null,
      governmentId: normalizeGovernmentId(contact?.government_id),
      reason,
      blacklistedBy: taggedBy,
    });
    await upsertLegacyBlacklistRecord(conn, branchId, {
      entityType: 'broker',
      partnerAgencyId,
      reason,
      taggedBy,
    });
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function clearBrokerBlacklistState(branchId, partnerAgencyId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `
      UPDATE blacklist
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = ? AND entity_type = 'broker' AND partner_agency_id = ? AND is_active = 1
      `,
      [branchId, partnerAgencyId],
    );
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

export async function tagBrokerPartnerAgencyBlacklist(branchId, partnerAgencyId, reason, taggedBy) {
  const contact = await fetchBrokerContact(branchId, partnerAgencyId);
  const conn = await pool.getConnection();
  let recordId;
  try {
    await conn.beginTransaction();
    recordId = await upsertBlacklistRow(conn, branchId, {
      entityType: 'broker',
      partnerAgencyId,
      name: contact?.name || '—',
      email: normalizeEmail(contact?.email),
      phone: contact?.phone ?? null,
      governmentId: normalizeGovernmentId(contact?.government_id),
      reason,
      blacklistedBy: taggedBy,
    });
    await upsertLegacyBlacklistRecord(conn, branchId, {
      entityType: 'broker',
      partnerAgencyId,
      reason,
      taggedBy,
    });
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
  const contact = await fetchTenantContact(branchId, tenantId);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `
      UPDATE tenant_profile
      SET is_blacklisted = 1, blacklist_reason = ?
      WHERE id = ? AND (branch_id = ? OR branch_id IS NULL)
      `,
      [reason, tenantId, branchId],
    );
    await upsertBlacklistRow(conn, branchId, {
      entityType: 'tenant',
      tenantId,
      name: contact?.name || '—',
      email: normalizeEmail(contact?.email),
      phone: contact?.phone ?? null,
      governmentId: normalizeGovernmentId(contact?.government_id),
      reason,
      blacklistedBy: taggedBy,
    });
    await upsertLegacyBlacklistRecord(conn, branchId, {
      entityType: 'tenant',
      tenantId,
      reason,
      taggedBy,
    });
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function getTenantContactForBlacklistCheck(branchId, tenantId) {
  return fetchTenantContact(branchId, tenantId);
}
