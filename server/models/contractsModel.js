import { pool } from '../config/db.js';
import { moveUnpaidSchedulesToContract, sumUnpaidBalanceForContract } from './paymentsModel.js';

/** Display name: "First Last", or USERNAME if names empty. */
const AGENT_NAME_SQL = `(
  CASE
    WHEN u.IDNO IS NULL THEN NULL
    WHEN TRIM(CONCAT(COALESCE(u.FIRSTNAME, ''), ' ', COALESCE(u.LASTNAME, ''))) = '' THEN u.USERNAME
    ELSE TRIM(CONCAT(COALESCE(u.FIRSTNAME, ''), ' ', COALESCE(u.LASTNAME, '')))
  END
) AS agent_name`;

function contractNoPrefixFromStartDate(startDateRaw) {
  const s = String(startDateRaw ?? '').trim().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = m[1];
  const month = m[2];
  // format requested: YYYYMM-#### (e.g. Apr 30 2026 → 202604-0001)
  return `${year}${month}-`;
}

async function generateNextContractNo(conn, branchId, startDateRaw) {
  const prefix = contractNoPrefixFromStartDate(startDateRaw);
  if (!prefix) throw new Error('Invalid startDate for contract_no generation');

  const like = `${prefix}%`;
  // Lock the latest row for this prefix to avoid concurrent duplicates.
  const [rows] = await conn.query(
    `
    SELECT contract_no
    FROM lease_contract
    WHERE branch_id = ? AND contract_no LIKE ?
    ORDER BY contract_no DESC
    LIMIT 1
    FOR UPDATE
    `,
    [branchId, like],
  );

  const last = rows?.[0]?.contract_no ? String(rows[0].contract_no) : '';
  const lastSeq = last.startsWith(prefix) ? Number(last.slice(prefix.length)) : 0;
  const nextSeq = Number.isFinite(lastSeq) && lastSeq > 0 ? lastSeq + 1 : 1;
  const seq4 = String(nextSeq).padStart(4, '0');
  return `${prefix}${seq4}`;
}

export async function listContractsByBranch(branchId) {
  const [rows] = await pool.query(
    `SELECT
        c.id,
        c.branch_id,
        c.contract_no,
        c.unit_id,
        ct.tenant_id,
        c.agent_id,
        ${AGENT_NAME_SQL},
        c.start_date,
        c.end_date,
        c.monthly_rent,
        c.security_deposit,
        c.advance_rent,
        c.contract_type,
        c.status,
        c.special_remarks AS remarks
     FROM lease_contract c
     LEFT JOIN contract_tenant ct
       ON ct.contract_id = c.id AND ct.is_primary = 1 AND ct.active = 1
     LEFT JOIN user_info u ON u.IDNO = c.agent_id
     WHERE c.branch_id = ? AND c.active = 1
     ORDER BY c.created_at DESC`,
    [branchId],
  );
  return rows;
}

/** Soft-deleted leases (`active = 0`), e.g. removed from the main operations list. */
export async function listArchivedContractsByBranch(branchId) {
  const [rows] = await pool.query(
    `SELECT
        c.id,
        c.branch_id,
        c.contract_no,
        c.unit_id,
        ct.tenant_id,
        c.agent_id,
        ${AGENT_NAME_SQL},
        c.start_date,
        c.end_date,
        c.monthly_rent,
        c.security_deposit,
        c.advance_rent,
        c.contract_type,
        c.status,
        c.special_remarks AS remarks
     FROM lease_contract c
     LEFT JOIN contract_tenant ct
       ON ct.contract_id = c.id AND ct.is_primary = 1 AND ct.active = 1
     LEFT JOIN user_info u ON u.IDNO = c.agent_id
     WHERE c.branch_id = ? AND c.active = 0
     ORDER BY COALESCE(c.updated_at, c.created_at) DESC`,
    [branchId],
  );
  return rows;
}

export async function insertContract(branchId, payload) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const contractNo = await generateNextContractNo(conn, branchId, payload.startDate);
    const [result] = await conn.query(
      `INSERT INTO lease_contract (
        branch_id, contract_no, unit_id, agent_id, start_date, end_date,
        monthly_rent, security_deposit, advance_rent, contract_type, status, special_remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        branchId,
        contractNo,
        payload.unitId,
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

    const contractId = result.insertId;
    await conn.query(
      `INSERT INTO contract_tenant (contract_id, tenant_id, is_primary, active) VALUES (?, ?, 1, 1)
       ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary), active = 1`,
      [contractId, payload.tenantId],
    );

    // When a lease becomes active, the unit should no longer be available.
    // Keep drafts from affecting inventory, but treat active leases as occupied.
    const status = String(payload.status).toLowerCase();
    if (status === 'active') {
      await conn.query(
        `UPDATE unit u
         JOIN property pr ON pr.id = u.property_id
         SET u.status = 'occupied'
         WHERE u.id = ? AND pr.branch_id = ?`,
        [payload.unitId, branchId],
      );
    } else if (status === 'draft') {
      await conn.query(
        `UPDATE unit u
         JOIN property pr ON pr.id = u.property_id
         SET u.status = 'reserved'
         WHERE u.id = ? AND pr.branch_id = ?`,
        [payload.unitId, branchId],
      );
    }

    await conn.commit();
    return getContractById(contractId, branchId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateContractById(id, branchId, payload) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `UPDATE lease_contract SET
        unit_id = ?,
        agent_id = ?,
        start_date = ?,
        end_date = ?,
        monthly_rent = ?,
        security_deposit = ?,
        advance_rent = ?,
        contract_type = ?,
        status = ?,
        special_remarks = ?
       WHERE id = ? AND branch_id = ? AND active = 1`,
      [
        payload.unitId,
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

    if (result.affectedRows > 0) {
      // ensure a single primary tenant row
      await conn.query('UPDATE contract_tenant SET active = 0 WHERE contract_id = ? AND is_primary = 1 AND active = 1', [
        id,
      ]);
      await conn.query(
        `INSERT INTO contract_tenant (contract_id, tenant_id, is_primary, active) VALUES (?, ?, 1, 1)
         ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary), active = 1`,
        [id, payload.tenantId],
      );

      // Keep unit inventory status in sync.
      // If the contract is active -> occupied.
      // If pending inspection (draft) -> reserved.
      // Otherwise -> vacant.
      const status = String(payload.status).toLowerCase();
      const unitStatus = status === 'active' ? 'occupied' : status === 'draft' ? 'reserved' : 'vacant';
      await conn.query(
        `UPDATE unit u
         JOIN property pr ON pr.id = u.property_id
         SET u.status = ?
         WHERE u.id = ? AND pr.branch_id = ?`,
        [unitStatus, payload.unitId, branchId],
      );
    }

    await conn.commit();
    return result.affectedRows;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function getContractById(id, branchId) {
  const [rows] = await pool.query(
    `SELECT
        c.id,
        c.branch_id,
        c.contract_no,
        c.unit_id,
        ct.tenant_id,
        c.agent_id,
        ${AGENT_NAME_SQL},
        c.start_date,
        c.end_date,
        c.monthly_rent,
        c.security_deposit,
        c.advance_rent,
        c.contract_type,
        c.status,
        c.special_remarks AS remarks
     FROM lease_contract c
     LEFT JOIN contract_tenant ct
       ON ct.contract_id = c.id AND ct.is_primary = 1 AND ct.active = 1
     LEFT JOIN user_info u ON u.IDNO = c.agent_id
     WHERE c.id = ? AND c.branch_id = ?
     LIMIT 1`,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function getContractDocumentDetails(contractId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      c.id AS contract_id,
      c.branch_id,
      c.contract_no,
      c.unit_id,
      c.landlord_id,
      c.agent_id,
      c.contract_type,
      c.status,
      c.start_date,
      c.end_date,
      c.monthly_rent,
      c.security_deposit,
      c.advance_rent,
      c.special_remarks AS contract_remarks,
      c.created_at AS contract_created_at,

      u.unit_no AS unit_number,
      u.floor_no AS unit_floor,
      u.tower AS unit_tower,
      pr.name AS building_name,
      pr.common_address,
      pr.legal_address,

      t.id AS tenant_id,
      t.full_name AS tenant_name,
      t.email AS tenant_email,
      t.mobile_no AS tenant_phone,

      ll.id AS landlord_id2,
      ll.full_name AS landlord_name,
      ll.mobile_no AS landlord_phone,
      ll.email AS landlord_email,
      ll.gov_id_no AS landlord_gov_id_no
    FROM lease_contract c
    INNER JOIN unit u ON u.id = c.unit_id
    INNER JOIN property pr ON pr.id = u.property_id AND pr.branch_id = c.branch_id
    LEFT JOIN contract_tenant ct ON ct.contract_id = c.id AND ct.is_primary = 1 AND ct.active = 1
    LEFT JOIN tenant_profile t ON t.id = ct.tenant_id
    LEFT JOIN landlord_profile ll ON ll.id = c.landlord_id
    WHERE c.id = ? AND c.branch_id = ?
    LIMIT 1
    `,
    [contractId, branchId],
  );
  return rows[0] ?? null;
}

export async function deleteContractById(id, branchId) {
  const [result] = await pool.query(
    `UPDATE lease_contract
     SET active = 0
     WHERE id = ? AND branch_id = ? AND active = 1`,
    [id, branchId],
  );
  return result.affectedRows;
}

/**
 * Renew an active lease: insert a new contract row, close the previous one (status completed),
 * optionally move unpaid payment_schedule rows to the new contract.
 */
export async function renewLeaseContract(branchId, oldContractId, payload) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [oldRows] = await conn.query(
      `
      SELECT
        c.id,
        c.contract_no,
        c.unit_id,
        c.agent_id,
        c.contract_type,
        c.status,
        c.start_date,
        c.end_date,
        c.monthly_rent,
        c.security_deposit,
        c.advance_rent,
        c.special_remarks,
        ct.tenant_id
      FROM lease_contract c
      LEFT JOIN contract_tenant ct
        ON ct.contract_id = c.id AND ct.is_primary = 1 AND ct.active = 1
      WHERE c.id = ? AND c.branch_id = ? AND c.active = 1
      LIMIT 1
      `,
      [oldContractId, branchId],
    );
    const old = oldRows[0];
    if (!old) {
      await conn.rollback();
      return { ok: false, code: 'NOT_FOUND' };
    }
    if (String(old.status).toLowerCase() !== 'active') {
      await conn.rollback();
      return { ok: false, code: 'NOT_ACTIVE' };
    }
    if (old.tenant_id == null) {
      await conn.rollback();
      return { ok: false, code: 'NO_TENANT' };
    }

    const unpaid = await sumUnpaidBalanceForContract(branchId, oldContractId, conn);
    if (payload.balanceHandling === 'require_payment' && unpaid > 0) {
      await conn.rollback();
      return { ok: false, code: 'BALANCE_DUE' };
    }

    const startDate = String(payload.startDate ?? '').trim().slice(0, 10);
    const endDate = String(payload.endDate ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      await conn.rollback();
      return { ok: false, code: 'INVALID_DATES' };
    }
    if (endDate <= startDate) {
      await conn.rollback();
      return { ok: false, code: 'DATE_ORDER' };
    }

    const monthlyRent = Number(payload.monthlyRent);
    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
      await conn.rollback();
      return { ok: false, code: 'INVALID_RENT' };
    }

    const userNotes = payload.notes == null ? '' : String(payload.notes).trim();
    const keepHistory = Boolean(payload.keepHistory);
    const carryOver = payload.balanceHandling === 'carry_over';

    const parts = [];
    if (keepHistory) {
      parts.push(`[Renewed from contract #${old.contract_no ?? oldContractId}]`);
    }
    if (carryOver && unpaid > 0) {
      parts.push(`[Carried unpaid balance: ₱${unpaid.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}]`);
    }
    if (userNotes) parts.push(userNotes);
    const remarks = parts.length ? parts.join('\n\n') : null;

    const contractNo = await generateNextContractNo(conn, branchId, startDate);
    const deposit = Number(old.security_deposit ?? 0);
    const advance = Number(old.advance_rent ?? 0);

    const [ins] = await conn.query(
      `INSERT INTO lease_contract (
        branch_id, contract_no, unit_id, agent_id, start_date, end_date,
        monthly_rent, security_deposit, advance_rent, contract_type, status, special_remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        branchId,
        contractNo,
        old.unit_id,
        old.agent_id,
        startDate,
        endDate,
        monthlyRent,
        deposit,
        advance,
        old.contract_type,
        remarks,
      ],
    );

    const newId = ins.insertId;
    await conn.query(
      `INSERT INTO contract_tenant (contract_id, tenant_id, is_primary, active) VALUES (?, ?, 1, 1)
       ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary), active = 1`,
      [newId, old.tenant_id],
    );

    await conn.query(
      `UPDATE unit u
       JOIN property pr ON pr.id = u.property_id
       SET u.status = 'occupied'
       WHERE u.id = ? AND pr.branch_id = ?`,
      [old.unit_id, branchId],
    );

    if (carryOver && unpaid > 0) {
      await moveUnpaidSchedulesToContract(conn, branchId, oldContractId, newId);
    }

    await conn.query(
      `UPDATE lease_contract
       SET status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND branch_id = ? AND active = 1`,
      [oldContractId, branchId],
    );

    await conn.commit();
    const row = await getContractById(newId, branchId);
    return { ok: true, contract: row, previousContractId: String(oldContractId), unpaidMoved: carryOver && unpaid > 0 };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function listContractTenants(contractId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      ct.contract_id,
      ct.tenant_id,
      ct.is_primary,
      ct.remarks,
      ct.created_at,
      t.full_name AS tenant_name,
      t.email AS tenant_email,
      t.mobile_no AS tenant_phone
    FROM contract_tenant ct
    INNER JOIN lease_contract lc ON lc.id = ct.contract_id AND lc.branch_id = ?
    INNER JOIN tenant_profile t ON t.id = ct.tenant_id AND t.active = 1
    WHERE ct.contract_id = ? AND ct.active = 1
    ORDER BY ct.is_primary DESC, ct.created_at DESC
    `,
    [branchId, contractId],
  );
  return rows;
}

export async function listCollaborationsByPartnerAgency(partnerAgencyId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      cc.id,
      cc.contract_id,
      cc.partner_agency_id,
      cc.commission_terms,
      cc.remarks,
      cc.created_by,
      cc.created_at,
      lc.contract_no,
      lc.start_date,
      lc.end_date,
      lc.status AS contract_status,
      u.unit_no AS unit_number,
      pr.name AS building_name
    FROM contract_collaboration cc
    INNER JOIN lease_contract lc ON lc.id = cc.contract_id AND lc.branch_id = ?
    LEFT JOIN unit u ON u.id = lc.unit_id
    LEFT JOIN property pr ON pr.id = u.property_id AND pr.branch_id = lc.branch_id
    WHERE cc.branch_id = ? AND cc.partner_agency_id = ?
    ORDER BY cc.created_at DESC, cc.id DESC
    `,
    [branchId, branchId, partnerAgencyId],
  );
  return rows;
}

export async function listContractCollaborations(contractId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      cc.id,
      cc.branch_id,
      cc.contract_id,
      cc.partner_agency_id,
      pa.agency_name AS partner_agency_name,
      pa.email AS partner_email,
      cc.commission_terms,
      cc.remarks,
      cc.created_by,
      cc.created_at
    FROM contract_collaboration cc
    INNER JOIN lease_contract lc ON lc.id = cc.contract_id AND lc.branch_id = ?
    LEFT JOIN partner_agency pa ON pa.id = cc.partner_agency_id
    WHERE cc.contract_id = ? AND cc.branch_id = ?
    ORDER BY cc.created_at DESC, cc.id DESC
    `,
    [branchId, contractId, branchId],
  );
  return rows;
}

async function findPartnerAgencyByEmail(branchId, email) {
  const e = String(email ?? '').trim();
  if (!e) return null;
  const [rows] = await pool.query(
    `
    SELECT id
    FROM partner_agency
    WHERE branch_id = ? AND LOWER(email) = LOWER(?)
    ORDER BY id DESC
    LIMIT 1
    `,
    [branchId, e],
  );
  return rows[0]?.id ?? null;
}

export async function findOrCreatePartnerAgencyForInvite(branchId, name, email) {
  const emailNorm = String(email ?? '').trim();
  const nameNorm = String(name ?? '').trim();
  if (emailNorm) {
    const byEmail = await findPartnerAgencyByEmail(branchId, emailNorm);
    if (byEmail) return String(byEmail);
  }

  const agencyName = nameNorm || emailNorm || 'Partner Agency';
  try {
    const [res] = await pool.query(
      `
      INSERT INTO partner_agency (
        branch_id,
        agency_name,
        contact_person,
        contact_number,
        email,
        kyc_verified,
        is_blacklisted,
        active
      ) VALUES (?, ?, ?, NULL, ?, 0, 0, 1)
      `,
      [branchId, agencyName, nameNorm || null, emailNorm || null],
    );
    return String(res.insertId);
  } catch (e) {
    // If duplicate agency name exists, just fetch that.
    if (e?.code === 'ER_DUP_ENTRY') {
      const [rows] = await pool.query(
        `SELECT id FROM partner_agency WHERE branch_id = ? AND agency_name = ? LIMIT 1`,
        [branchId, agencyName],
      );
      if (rows[0]?.id) return String(rows[0].id);
    }
    throw e;
  }
}

export async function insertContractCollaboration(branchId, contractId, payload) {
  const [result] = await pool.query(
    `
    INSERT INTO contract_collaboration (
      branch_id,
      contract_id,
      partner_agency_id,
      commission_terms,
      remarks,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      branchId,
      contractId,
      payload.partnerAgencyId,
      payload.commissionTerms ?? null,
      payload.remarks ?? null,
      payload.createdBy ?? null,
    ],
  );
  return result.insertId;
}

export async function updateContractCollaboration(branchId, contractId, collabId, payload) {
  const [result] = await pool.query(
    `
    UPDATE contract_collaboration
    SET commission_terms = ?, remarks = ?
    WHERE id = ? AND branch_id = ? AND contract_id = ?
    `,
    [
      payload.commissionTerms ?? null,
      payload.remarks ?? null,
      collabId,
      branchId,
      contractId,
    ],
  );

  if (result.affectedRows > 0 && (payload.name !== undefined || payload.email !== undefined)) {
    const [rows] = await pool.query(
      `SELECT partner_agency_id FROM contract_collaboration WHERE id = ?`,
      [collabId]
    );
    if (rows[0]) {
      const paId = rows[0].partner_agency_id;
      const updates = [];
      const values = [];
      if (payload.name !== undefined) {
        updates.push('agency_name = ?');
        values.push(payload.name || '');
      }
      if (payload.email !== undefined) {
        updates.push('email = ?');
        values.push(payload.email || null);
      }
      if (updates.length > 0) {
        await pool.query(
          `UPDATE partner_agency SET ${updates.join(', ')} WHERE id = ?`,
          [...values, paId]
        );
      }
    }
  }

  return result.affectedRows;
}

export async function updateContractTenantRemarks(branchId, contractId, tenantId, payload) {
  const [result] = await pool.query(
    `
    UPDATE contract_tenant ct
    JOIN lease_contract lc ON ct.contract_id = lc.id
    SET ct.remarks = ?
    WHERE ct.contract_id = ? AND ct.tenant_id = ? AND lc.branch_id = ?
    `,
    [payload.remarks ?? null, contractId, tenantId, branchId],
  );

  if (result.affectedRows > 0 && (payload.name !== undefined || payload.email !== undefined)) {
    const updates = [];
    const values = [];
    if (payload.name !== undefined) {
      updates.push('full_name = ?');
      values.push(payload.name || '');
    }
    if (payload.email !== undefined) {
      updates.push('email = ?');
      values.push(payload.email || null);
    }
    if (updates.length > 0) {
      await pool.query(
        `UPDATE tenant_profile SET ${updates.join(', ')} WHERE id = ?`,
        [...values, tenantId]
      );
    }
  }

  return result.affectedRows;
}
