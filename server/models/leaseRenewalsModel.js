import { pool } from '../config/db.js';
import { getContractById, renewLeaseContract } from './contractsModel.js';
import { sumUnpaidBalanceForContract } from './paymentsModel.js';

const WORKFLOW_STEPS = ['summary', 'balance', 'terms', 'agreement', 'approval', 'activation'];
const RENEWAL_STATUSES = [
  'pending_renewal',
  'awaiting_payment',
  'pending_signature',
  'ready_to_activate',
  'active',
  'declined',
];

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function categorizeNote(note) {
  const n = String(note ?? '').toLowerCase();
  if (/utilit|water|electric|power|gas/.test(n)) return 'utilities';
  if (/penalt|late|fine/.test(n)) return 'penalties';
  if (/parking|garage/.test(n)) return 'parkingFees';
  if (/assoc|dues|hoa|condo/.test(n)) return 'otherCharges';
  return 'outstandingRent';
}

export async function computeBalanceBreakdown(branchId, contractId, conn = pool) {
  const [rows] = await conn.query(
    `
    SELECT amount_due, notes
    FROM payment_schedule
    WHERE branch_id = ?
      AND contract_id = ?
      AND active = 1
      AND status <> 'paid'
    `,
    [branchId, contractId],
  );

  const breakdown = {
    outstandingRent: 0,
    utilities: 0,
    penalties: 0,
    parkingFees: 0,
    otherCharges: 0,
  };

  for (const row of rows) {
    const amount = Number(row.amount_due ?? 0);
    const bucket = categorizeNote(row.notes);
    breakdown[bucket] += amount;
  }

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { breakdown, total };
}

async function countPreviousRenewals(tenantId, excludeRenewalId = null) {
  const params = [tenantId];
  let sql = `
    SELECT COUNT(*) AS n
    FROM lease_renewals
    WHERE tenant_id = ?
      AND renewal_status = 'active'
      AND active = 1
  `;
  if (excludeRenewalId != null) {
    sql += ' AND id <> ?';
    params.push(excludeRenewalId);
  }
  const [rows] = await pool.query(sql, params);
  return Number(rows[0]?.n ?? 0);
}

async function getTenantSince(tenantId) {
  const [rows] = await pool.query(
    `
    SELECT MIN(created_at) AS since_at
    FROM contract_tenant
    WHERE tenant_id = ? AND active = 1
    `,
    [tenantId],
  );
  return rows[0]?.since_at ?? null;
}

async function loadContractSummary(branchId, contractId) {
  const [rows] = await pool.query(
    `
    SELECT
      lc.id,
      lc.contract_no,
      lc.unit_id,
      lc.start_date,
      lc.end_date,
      lc.monthly_rent,
      lc.security_deposit,
      lc.advance_rent,
      lc.status,
      u.unit_no,
      ct.tenant_id,
      COALESCE(tp.full_name, '') AS tenant_name
    FROM lease_contract lc
    JOIN unit u ON u.id = lc.unit_id
    LEFT JOIN contract_tenant ct ON ct.contract_id = lc.id AND ct.is_primary = 1 AND ct.active = 1
    LEFT JOIN tenant_profile tp ON tp.id = ct.tenant_id AND tp.active = 1
    WHERE lc.id = ? AND lc.branch_id = ? AND lc.active = 1
    LIMIT 1
    `,
    [contractId, branchId],
  );
  return rows[0] ?? null;
}

export function rowToRenewal(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    oldContractId: String(row.old_contract_id),
    newContractId: row.new_contract_id != null ? String(row.new_contract_id) : null,
    tenantId: String(row.tenant_id),
    unitId: String(row.unit_id),
    renewalStatus: row.renewal_status,
    workflowStep: row.workflow_step,
    outstandingBalance: Number(row.outstanding_balance ?? 0),
    balanceBreakdown: parseJson(row.balance_breakdown_json, {}),
    carryOverBalance: Boolean(row.carry_over_balance),
    carryOverReason: row.carry_over_reason ?? '',
    internalNotes: row.internal_notes ?? '',
    terms: parseJson(row.terms_json, {}),
    rentIncreasePercentage: row.rent_increase_percentage != null ? Number(row.rent_increase_percentage) : null,
    approvalStatus: row.approval_status,
    tenantSignatureStatus: row.tenant_signature_status,
    managerApprovalNotes: row.manager_approval_notes ?? '',
    signedAt: row.signed_at ?? null,
    activationDate: row.activation_date ?? null,
    createdBy: row.created_by != null ? String(row.created_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToApproval(row) {
  return {
    id: String(row.id),
    renewalId: String(row.renewal_id),
    approverRole: row.approver_role,
    approverUserId: row.approver_user_id != null ? String(row.approver_user_id) : null,
    status: row.status,
    notes: row.notes ?? '',
    decidedAt: row.decided_at ?? null,
    createdAt: row.created_at,
  };
}

export function rowToLog(row) {
  return {
    id: String(row.id),
    renewalId: String(row.renewal_id),
    eventType: row.event_type,
    message: row.message,
    actorUserId: row.actor_user_id != null ? String(row.actor_user_id) : null,
    createdAt: row.created_at,
  };
}

export async function insertRenewalLog(conn, renewalId, eventType, message, actorUserId = null) {
  await conn.query(
    `
    INSERT INTO lease_renewal_logs (renewal_id, event_type, message, actor_user_id)
    VALUES (?, ?, ?, ?)
    `,
    [renewalId, eventType, message, actorUserId],
  );
}

function defaultTermsFromContract(contract) {
  const prevEnd = new Date(contract.end_date);
  const start = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() + 1);
  const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  const prevRent = Number(contract.monthly_rent ?? 0);
  const newRent = Math.round(prevRent * 1.05 * 100) / 100;
  const increasePct = prevRent > 0 ? Math.round(((newRent - prevRent) / prevRent) * 10000) / 100 : 0;

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    leaseTerm: '12',
    monthlyRent: newRent,
    previousRent: prevRent,
    securityDeposit: Number(contract.security_deposit ?? 0),
    advanceRent: Number(contract.advance_rent ?? 0),
    parkingFee: 0,
    associationDues: 0,
    renewalFee: 0,
    rentIncreasePercentage: increasePct,
  };
}

function deriveRenewalStatus(row) {
  if (row.renewal_status === 'active' || row.renewal_status === 'declined') {
    return row.renewal_status;
  }
  const outstanding = Number(row.outstanding_balance ?? 0);
  const carryOver = Boolean(row.carry_over_balance);
  if (outstanding > 0 && !carryOver) return 'awaiting_payment';
  if (row.tenant_signature_status !== 'signed' || row.approval_status !== 'approved') {
    return 'pending_signature';
  }
  if (row.new_contract_id) return 'ready_to_activate';
  return row.renewal_status ?? 'pending_renewal';
}

async function syncDerivedStatus(conn, renewalId) {
  const [rows] = await conn.query(`SELECT * FROM lease_renewals WHERE id = ? AND active = 1 LIMIT 1`, [renewalId]);
  const row = rows[0];
  if (!row) return;
  const next = deriveRenewalStatus(row);
  if (next !== row.renewal_status) {
    await conn.query(`UPDATE lease_renewals SET renewal_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      next,
      renewalId,
    ]);
  }
}

export async function listRenewalLogs(renewalId) {
  const [rows] = await pool.query(
    `SELECT * FROM lease_renewal_logs WHERE renewal_id = ? ORDER BY created_at DESC, id DESC`,
    [renewalId],
  );
  return rows;
}

export async function listRenewalApprovals(renewalId) {
  const [rows] = await pool.query(
    `SELECT * FROM lease_renewal_approvals WHERE renewal_id = ? ORDER BY created_at ASC, id ASC`,
    [renewalId],
  );
  return rows;
}

export async function getRenewalRowById(renewalId, branchId) {
  const [rows] = await pool.query(
    `SELECT * FROM lease_renewals WHERE id = ? AND branch_id = ? AND active = 1 LIMIT 1`,
    [renewalId, branchId],
  );
  return rows[0] ?? null;
}

export async function getActiveDraftRenewalForContract(branchId, contractId) {
  const [rows] = await pool.query(
    `
    SELECT *
    FROM lease_renewals
    WHERE branch_id = ?
      AND old_contract_id = ?
      AND active = 1
      AND renewal_status NOT IN ('active', 'declined')
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
    `,
    [branchId, contractId],
  );
  return rows[0] ?? null;
}

export async function buildRenewalPayload(branchId, renewalRow) {
  const contract = await loadContractSummary(branchId, renewalRow.old_contract_id);
  const tenantSince = await getTenantSince(renewalRow.tenant_id);
  const previousRenewals = await countPreviousRenewals(renewalRow.tenant_id, renewalRow.id);
  const newContract =
    renewalRow.new_contract_id != null
      ? await loadContractSummary(branchId, renewalRow.new_contract_id)
      : null;

  const [approvals, logs] = await Promise.all([
    listRenewalApprovals(renewalRow.id),
    listRenewalLogs(renewalRow.id),
  ]);

  return {
    renewal: rowToRenewal(renewalRow),
    summary: {
      contractNumber: contract?.contract_no ?? '',
      unitNumber: contract?.unit_no ?? '',
      tenantName: String(contract?.tenant_name ?? '').trim(),
      currentLeaseStart: contract?.start_date ?? null,
      currentLeaseEnd: contract?.end_date ?? null,
      tenantSince,
      previousRenewals,
      currentMonthlyRent: Number(contract?.monthly_rent ?? 0),
    },
    newContractPreview: newContract
      ? {
          contractNumber: newContract.contract_no,
          startDate: newContract.start_date,
          endDate: newContract.end_date,
          monthlyRent: Number(newContract.monthly_rent ?? 0),
        }
      : null,
    approvals: approvals.map(rowToApproval),
    logs: logs.map(rowToLog),
  };
}

export async function createOrGetRenewalDraft(branchId, contractId, actorUserId) {
  const contract = await loadContractSummary(branchId, contractId);
  if (!contract) return { ok: false, code: 'NOT_FOUND' };
  if (String(contract.status).toLowerCase() !== 'active') return { ok: false, code: 'NOT_ACTIVE' };
  if (contract.tenant_id == null) return { ok: false, code: 'NO_TENANT' };

  const existing = await getActiveDraftRenewalForContract(branchId, contractId);
  if (existing) {
    const payload = await buildRenewalPayload(branchId, existing);
    return { ok: true, ...payload, created: false };
  }

  const { breakdown, total } = await computeBalanceBreakdown(branchId, contractId);
  const terms = defaultTermsFromContract(contract);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ins] = await conn.query(
      `
      INSERT INTO lease_renewals (
        branch_id, old_contract_id, tenant_id, unit_id,
        renewal_status, workflow_step, outstanding_balance, balance_breakdown_json,
        terms_json, rent_increase_percentage, created_by
      ) VALUES (?, ?, ?, ?, 'pending_renewal', 'summary', ?, ?, ?, ?, ?)
      `,
      [
        branchId,
        contractId,
        contract.tenant_id,
        contract.unit_id,
        total,
        JSON.stringify(breakdown),
        JSON.stringify(terms),
        terms.rentIncreasePercentage,
        actorUserId,
      ],
    );
    const renewalId = ins.insertId;

    await conn.query(
      `
      INSERT INTO lease_renewal_approvals (renewal_id, approver_role, status)
      VALUES (?, 'manager', 'pending')
      `,
      [renewalId],
    );

    await insertRenewalLog(
      conn,
      renewalId,
      'renewal_started',
      'Lease renewal started',
      actorUserId,
    );

    await conn.commit();
    const row = await getRenewalRowById(renewalId, branchId);
    const payload = await buildRenewalPayload(branchId, row);
    return { ok: true, ...payload, created: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateRenewalDraft(branchId, renewalId, patch, actorUserId) {
  const row = await getRenewalRowById(renewalId, branchId);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  if (['active', 'declined'].includes(row.renewal_status)) return { ok: false, code: 'LOCKED' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const sets = [];
    const params = [];

    if (patch.workflowStep && WORKFLOW_STEPS.includes(patch.workflowStep)) {
      sets.push('workflow_step = ?');
      params.push(patch.workflowStep);
    }

    if (patch.carryOverBalance != null) {
      sets.push('carry_over_balance = ?');
      params.push(patch.carryOverBalance ? 1 : 0);
    }
    if (patch.carryOverReason != null) {
      sets.push('carry_over_reason = ?');
      params.push(String(patch.carryOverReason).trim() || null);
    }
    if (patch.internalNotes != null) {
      sets.push('internal_notes = ?');
      params.push(String(patch.internalNotes).trim() || null);
    }

    if (patch.terms && typeof patch.terms === 'object') {
      const merged = { ...parseJson(row.terms_json, {}), ...patch.terms };
      sets.push('terms_json = ?');
      params.push(JSON.stringify(merged));
      if (merged.rentIncreasePercentage != null) {
        sets.push('rent_increase_percentage = ?');
        params.push(Number(merged.rentIncreasePercentage));
      }
    }

    if (patch.managerApprovalNotes != null) {
      sets.push('manager_approval_notes = ?');
      params.push(String(patch.managerApprovalNotes).trim() || null);
    }

    if (sets.length) {
      sets.push('updated_at = CURRENT_TIMESTAMP');
      params.push(renewalId, branchId);
      await conn.query(
        `UPDATE lease_renewals SET ${sets.join(', ')} WHERE id = ? AND branch_id = ? AND active = 1`,
        params,
      );
    }

    if (patch.workflowStep === 'balance') {
      await insertRenewalLog(conn, renewalId, 'balance_reviewed', 'Outstanding balance reviewed', actorUserId);
    }
    if (patch.terms) {
      await insertRenewalLog(conn, renewalId, 'rent_updated', 'Lease terms updated', actorUserId);
    }
    if (patch.carryOverBalance) {
      await insertRenewalLog(
        conn,
        renewalId,
        'carry_over_approved',
        'Carry over balance approved by admin',
        actorUserId,
      );
    }

    await syncDerivedStatus(conn, renewalId);
    await conn.commit();

    const updated = await getRenewalRowById(renewalId, branchId);
    const payload = await buildRenewalPayload(branchId, updated);
    return { ok: true, ...payload };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function saveRenewalDraft(branchId, renewalId, actorUserId) {
  const row = await getRenewalRowById(renewalId, branchId);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  await insertRenewalLog(pool, renewalId, 'draft_saved', 'Renewal draft saved', actorUserId);
  const payload = await buildRenewalPayload(branchId, row);
  return { ok: true, ...payload };
}

export async function recordAgreementGenerated(branchId, renewalId, actorUserId) {
  const row = await getRenewalRowById(renewalId, branchId);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  await insertRenewalLog(pool, renewalId, 'agreement_generated', 'Renewal agreement generated', actorUserId);
  const payload = await buildRenewalPayload(branchId, row);
  return { ok: true, ...payload };
}

export async function approveManagerRenewal(branchId, renewalId, body, actorUserId) {
  const row = await getRenewalRowById(renewalId, branchId);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  if (['active', 'declined'].includes(row.renewal_status)) return { ok: false, code: 'LOCKED' };

  const status = body.status === 'rejected' ? 'rejected' : 'approved';
  const notes = body.notes == null ? '' : String(body.notes).trim();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `
      UPDATE lease_renewal_approvals
      SET status = ?, notes = ?, approver_user_id = ?, decided_at = CURRENT_TIMESTAMP
      WHERE renewal_id = ? AND approver_role = 'manager'
      `,
      [status, notes || null, actorUserId, renewalId],
    );
    await conn.query(
      `
      UPDATE lease_renewals
      SET approval_status = ?, manager_approval_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND branch_id = ?
      `,
      [status, notes || null, renewalId, branchId],
    );
    await insertRenewalLog(
      conn,
      renewalId,
      status === 'approved' ? 'renewal_approved' : 'renewal_rejected',
      status === 'approved' ? 'Manager approved renewal' : 'Manager rejected renewal',
      actorUserId,
    );
    await syncDerivedStatus(conn, renewalId);
    await conn.commit();
    const updated = await getRenewalRowById(renewalId, branchId);
    return { ok: true, ...(await buildRenewalPayload(branchId, updated)) };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function recordTenantSignature(branchId, renewalId, body, actorUserId) {
  const row = await getRenewalRowById(renewalId, branchId);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  if (['active', 'declined'].includes(row.renewal_status)) return { ok: false, code: 'LOCKED' };

  const status = body.status === 'rejected' ? 'rejected' : 'signed';
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `
      UPDATE lease_renewals
      SET tenant_signature_status = ?, signed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND branch_id = ?
      `,
      [status, renewalId, branchId],
    );
    await insertRenewalLog(
      conn,
      renewalId,
      status === 'signed' ? 'tenant_signed' : 'tenant_signature_rejected',
      status === 'signed' ? 'Tenant signature recorded' : 'Tenant signature rejected',
      actorUserId,
    );
    await syncDerivedStatus(conn, renewalId);
    await conn.commit();
    const updated = await getRenewalRowById(renewalId, branchId);
    return { ok: true, ...(await buildRenewalPayload(branchId, updated)) };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function declineRenewal(branchId, renewalId, actorUserId, reason = '') {
  const row = await getRenewalRowById(renewalId, branchId);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  if (row.renewal_status === 'active') return { ok: false, code: 'LOCKED' };

  await pool.query(
    `
    UPDATE lease_renewals
    SET renewal_status = 'declined', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND branch_id = ?
    `,
    [renewalId, branchId],
  );
  await insertRenewalLog(
    pool,
    renewalId,
    'renewal_declined',
    reason ? `Renewal declined: ${reason}` : 'Renewal declined',
    actorUserId,
  );
  const updated = await getRenewalRowById(renewalId, branchId);
  return { ok: true, ...(await buildRenewalPayload(branchId, updated)) };
}

export async function activateRenewal(branchId, renewalId, body, actorUserId) {
  const row = await getRenewalRowById(renewalId, branchId);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  if (row.renewal_status === 'active') return { ok: false, code: 'ALREADY_ACTIVE' };
  if (row.renewal_status === 'declined') return { ok: false, code: 'DECLINED' };

  const outstanding = Number(row.outstanding_balance ?? 0);
  const carryOver = Boolean(row.carry_over_balance);
  if (outstanding > 0 && !carryOver) return { ok: false, code: 'BALANCE_DUE' };
  if (carryOver && outstanding > 0 && !String(row.carry_over_reason ?? '').trim()) {
    return { ok: false, code: 'CARRY_OVER_REASON_REQUIRED' };
  }
  if (row.approval_status !== 'approved') return { ok: false, code: 'APPROVAL_REQUIRED' };
  if (row.tenant_signature_status !== 'signed') return { ok: false, code: 'SIGNATURE_REQUIRED' };

  const terms = parseJson(row.terms_json, {});
  const startDate = String(terms.startDate ?? '').slice(0, 10);
  const endDate = String(terms.endDate ?? '').slice(0, 10);
  const monthlyRent = Number(terms.monthlyRent);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, code: 'INVALID_DATES' };
  }
  if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) return { ok: false, code: 'INVALID_RENT' };

  const noteParts = [];
  if (row.internal_notes) noteParts.push(String(row.internal_notes).trim());
  if (carryOver && row.carry_over_reason) noteParts.push(`[Carry over reason] ${row.carry_over_reason}`);
  const feeParts = [];
  if (Number(terms.parkingFee) > 0) feeParts.push(`Parking: ₱${Number(terms.parkingFee).toFixed(2)}`);
  if (Number(terms.associationDues) > 0) feeParts.push(`Association dues: ₱${Number(terms.associationDues).toFixed(2)}`);
  if (Number(terms.renewalFee) > 0) feeParts.push(`Renewal fee: ₱${Number(terms.renewalFee).toFixed(2)}`);
  if (feeParts.length) noteParts.push(`[Renewal charges] ${feeParts.join('; ')}`);

  const renewResult = await renewLeaseContract(branchId, row.old_contract_id, {
    startDate,
    endDate,
    monthlyRent,
    balanceHandling: carryOver ? 'carry_over' : 'require_payment',
    notes: noteParts.join('\n\n') || null,
    keepHistory: true,
    securityDeposit: Number(terms.securityDeposit ?? 0),
    advanceRent: Number(terms.advanceRent ?? 0),
  });

  if (!renewResult.ok) return renewResult;

  const activationDate =
    body.activationDate && /^\d{4}-\d{2}-\d{2}$/.test(String(body.activationDate).slice(0, 10))
      ? String(body.activationDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  await pool.query(
    `
    UPDATE lease_renewals
    SET
      new_contract_id = ?,
      renewal_status = 'active',
      workflow_step = 'activation',
      activation_date = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND branch_id = ?
    `,
    [renewResult.contract.id, activationDate, renewalId, branchId],
  );

  await insertRenewalLog(
    pool,
    renewalId,
    'renewal_activated',
    `Renewal activated — new contract #${renewResult.contract.contract_no ?? renewResult.contract.id}`,
    actorUserId,
  );

  const updated = await getRenewalRowById(renewalId, branchId);
  return {
    ok: true,
    contract: renewResult.contract,
    previousContractId: renewResult.previousContractId,
    ...(await buildRenewalPayload(branchId, updated)),
  };
}

export async function refreshRenewalBalance(branchId, renewalId) {
  const row = await getRenewalRowById(renewalId, branchId);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  const { breakdown, total } = await computeBalanceBreakdown(branchId, row.old_contract_id);
  await pool.query(
    `
    UPDATE lease_renewals
    SET outstanding_balance = ?, balance_breakdown_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND branch_id = ?
    `,
    [total, JSON.stringify(breakdown), renewalId, branchId],
  );
  const updated = await getRenewalRowById(renewalId, branchId);
  return { ok: true, ...(await buildRenewalPayload(branchId, updated)) };
}

export async function getRenewalReportContext(branchId, renewalId) {
  const row = await getRenewalRowById(renewalId, branchId);
  if (!row) return null;
  const payload = await buildRenewalPayload(branchId, row);
  const oldContract = await getContractById(row.old_contract_id, branchId);
  return { row, payload, oldContract };
}

export { RENEWAL_STATUSES, WORKFLOW_STEPS };
