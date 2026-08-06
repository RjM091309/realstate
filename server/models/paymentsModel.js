import { pool } from '../config/db.js';
import { emitBranchNotificationsChanged } from '../realtime/io.js';

/** YYYY-MM-DD from MySQL DATE / Date / string (matches paymentsController local formatting). */
function toYmd(value) {
  if (value == null) return '';
  if (typeof value === 'string') {
    const s = value.trim();
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return '';
}

function daysInMonth(year, month1to12) {
  return new Date(year, month1to12, 0).getDate();
}

function ymdWithClampedDay(year, month1to12, day) {
  const dim = daysInMonth(year, month1to12);
  const d = Math.min(Math.max(1, day), dim);
  return `${year}-${String(month1to12).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Monthly rent due dates for a lease: first due on start date, then same day each month
 * while due < end date (typical 12 dues for a 1-year lease).
 */
export function buildMonthlyDueDates(startDate, endDate) {
  const start = toYmd(startDate);
  const end = toYmd(endDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start >= end) {
    return [];
  }
  const anchorDay = Number(start.slice(8, 10));
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  const out = [];
  let due = start;
  // Cap at 120 months to avoid runaway loops on bad data.
  for (let i = 0; i < 120 && due < end; i += 1) {
    out.push(due);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    due = ymdWithClampedDay(year, month, anchorDay);
  }
  return out;
}

/**
 * Insert missing monthly payment_schedule rows for a contract (idempotent).
 * @returns {Promise<number>} number of rows inserted
 */
export async function ensureMonthlyPaymentSchedule(
  branchId,
  contractId,
  { startDate, endDate, monthlyRent },
  conn = pool,
) {
  const amount = Number(monthlyRent);
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const dues = buildMonthlyDueDates(startDate, endDate);
  if (!dues.length) return 0;

  const [existing] = await conn.query(
    `
    SELECT due_date
    FROM payment_schedule
    WHERE branch_id = ? AND contract_id = ? AND active = 1
    `,
    [branchId, contractId],
  );
  const have = new Set(existing.map((r) => toYmd(r.due_date)).filter(Boolean));
  const today = toYmd(new Date());
  const missing = dues.filter((d) => !have.has(d));
  if (!missing.length) return 0;

  const values = [];
  const params = [];
  for (const due of missing) {
    values.push('(?, ?, ?, ?, ?, 1, ?)');
    params.push(
      branchId,
      contractId,
      due,
      amount,
      due < today ? 'overdue' : 'pending',
      'Monthly rent',
    );
  }

  await conn.query(
    `
    INSERT INTO payment_schedule (
      branch_id, contract_id, due_date, amount_due, status, active, notes
    ) VALUES ${values.join(', ')}
    `,
    params,
  );

  emitBranchNotificationsChanged(branchId);
  return missing.length;
}

/** Ensure every active lease in the branch has a full monthly rent schedule. */
export async function backfillMonthlySchedulesForBranch(branchId, conn = pool) {
  const [contracts] = await conn.query(
    `
    SELECT id, start_date, end_date, monthly_rent
    FROM lease_contract
    WHERE branch_id = ?
      AND active = 1
      AND status = 'active'
    `,
    [branchId],
  );
  let total = 0;
  for (const c of contracts) {
    total += await ensureMonthlyPaymentSchedule(
      branchId,
      c.id,
      {
        startDate: toYmd(c.start_date),
        endDate: toYmd(c.end_date),
        monthlyRent: c.monthly_rent,
      },
      conn,
    );
    total += await pruneOffScheduleDues(
      branchId,
      c.id,
      {
        startDate: toYmd(c.start_date),
        endDate: toYmd(c.end_date),
      },
      conn,
    );
  }
  return total;
}

/**
 * Soft-delete dues that are not on the lease monthly schedule
 * (legacy one-off / wrong-year rows, including mistaken paid entries).
 */
export async function pruneOffScheduleDues(
  branchId,
  contractId,
  { startDate, endDate },
  conn = pool,
) {
  const expected = new Set(buildMonthlyDueDates(startDate, endDate));
  if (!expected.size) return 0;
  const [rows] = await conn.query(
    `
    SELECT id, due_date
    FROM payment_schedule
    WHERE branch_id = ?
      AND contract_id = ?
      AND active = 1
    `,
    [branchId, contractId],
  );
  const badIds = rows
    .filter((r) => !expected.has(toYmd(r.due_date)))
    .map((r) => r.id);
  if (!badIds.length) return 0;
  await conn.query(
    `
    UPDATE payment_schedule
    SET active = 0
    WHERE branch_id = ?
      AND contract_id = ?
      AND active = 1
      AND id IN (${badIds.map(() => '?').join(',')})
    `,
    [branchId, contractId, ...badIds],
  );
  await conn.query(
    `
    UPDATE payment_transaction
    SET active = 0
    WHERE payment_schedule_id IN (${badIds.map(() => '?').join(',')})
      AND active = 1
    `,
    badIds,
  );
  return badIds.length;
}

const monthlyBackfillDone = new Set();

/** Sum of past-due / overdue unpaid payment_schedule rows (excludes future months). */
export async function sumUnpaidBalanceForContract(branchId, contractId, conn = pool) {
  const [rows] = await conn.query(
    `
    SELECT COALESCE(SUM(amount_due), 0) AS total
    FROM payment_schedule
    WHERE branch_id = ?
      AND contract_id = ?
      AND active = 1
      AND status <> 'paid'
      AND (
        status = 'overdue'
        OR due_date IS NULL
        OR due_date <= CURDATE()
      )
    `,
    [branchId, contractId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function moveUnpaidSchedulesToContract(conn, branchId, fromContractId, toContractId) {
  const [result] = await conn.query(
    `
    UPDATE payment_schedule
    SET contract_id = ?
    WHERE branch_id = ?
      AND contract_id = ?
      AND active = 1
      AND status <> 'paid'
    `,
    [toContractId, branchId, fromContractId],
  );
  return result.affectedRows ?? 0;
}

const STATUS_MAP_TO_SCHEDULE = {
  Paid: 'paid',
  Overdue: 'overdue',
  Pending: 'pending',
};

function mapToScheduleStatus(appStatus) {
  return STATUS_MAP_TO_SCHEDULE[appStatus] ?? 'pending';
}

function normalizePaymentMethod(value) {
  const allowed = new Set(['cash', 'bank_transfer', 'online', 'check', 'other']);
  const method = String(value ?? 'cash').trim().toLowerCase();
  return allowed.has(method) ? method : 'cash';
}

const PAYMENT_METHOD_SUBQUERY = `
  (
    SELECT pt_inner.payment_method
    FROM payment_transaction pt_inner
    WHERE pt_inner.payment_schedule_id = ps.id
      AND pt_inner.active = 1
    ORDER BY pt_inner.payment_date DESC, pt_inner.id DESC
    LIMIT 1
  ) AS payment_method
`;

export async function listPaymentsByBranch(branchId) {
  if (!monthlyBackfillDone.has(branchId)) {
    try {
      await backfillMonthlySchedulesForBranch(branchId);
      monthlyBackfillDone.add(branchId);
    } catch (e) {
      console.error('[payments] monthly schedule backfill failed:', e);
    }
  }

  const [rows] = await pool.query(
    `
    SELECT
      ps.id,
      ps.branch_id,
      ps.contract_id,
      lc.unit_id,
      ps.amount_due AS amount,
      ps.due_date AS due_date,
      MAX(pt.payment_date) AS paid_date,
      CASE ps.status
        WHEN 'paid' THEN 'Paid'
        WHEN 'overdue' THEN 'Overdue'
        ELSE 'Pending'
      END AS status,
      ps.notes AS remarks,
      ${PAYMENT_METHOD_SUBQUERY}
    FROM payment_schedule ps
    JOIN lease_contract lc
      ON lc.id = ps.contract_id AND lc.branch_id = ps.branch_id AND lc.active = 1
    LEFT JOIN payment_transaction pt
      ON pt.payment_schedule_id = ps.id AND pt.active = 1
    WHERE ps.branch_id = ?
      AND ps.active = 1
    GROUP BY ps.id, ps.branch_id, ps.contract_id, lc.unit_id, ps.amount_due, ps.due_date, ps.status, ps.notes
    ORDER BY ps.due_date DESC, ps.created_at DESC
    `,
    [branchId],
  );
  return rows;
}

export async function insertPayment(branchId, payload) {
  const [contractRows] = await pool.query(
    `SELECT id FROM lease_contract WHERE id = ? AND branch_id = ? AND active = 1 LIMIT 1`,
    [payload.contractId, branchId],
  );
  if (!contractRows[0]?.id) throw new Error('Contract not found for branch');

  const [res] = await pool.query(
    `
    INSERT INTO payment_schedule (
      branch_id,
      contract_id,
      due_date,
      amount_due,
      status,
      active
    ) VALUES (?, ?, ?, ?, ?, 1)
    `,
    [branchId, payload.contractId, payload.dueDate, payload.amount, mapToScheduleStatus(payload.status)],
  );

  const scheduleId = res.insertId;

  if (payload.status === 'Paid') {
    const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
    await pool.query(
      `
      INSERT INTO payment_transaction (
        branch_id,
        payment_schedule_id,
        amount_paid,
        payment_date,
        payment_method,
        active
      ) VALUES (?, ?, ?, ?, ?, 1)
      `,
      [branchId, scheduleId, payload.amount, payload.paidDate ?? payload.dueDate, paymentMethod],
    );
  }

  emitBranchNotificationsChanged(branchId);
  return getPaymentById(scheduleId, branchId);
}

export async function updatePaymentById(id, branchId, payload) {
  const [rows] = await pool.query(
    `
    SELECT ps.id
    FROM payment_schedule ps
    WHERE ps.id = ? AND ps.branch_id = ? AND ps.active = 1
    LIMIT 1
    `,
    [id, branchId],
  );
  if (!rows[0]?.id) return 0;

  const scheduleStatus = mapToScheduleStatus(payload.status);

  const setClauses = ['amount_due = ?', 'due_date = ?', 'status = ?'];
  const setValues = [payload.amount, payload.dueDate, scheduleStatus];
  if (payload.remarks !== undefined) {
    setClauses.push('notes = ?');
    setValues.push(payload.remarks);
  }
  setValues.push(id, branchId);

  const [result] = await pool.query(
    `
    UPDATE payment_schedule
    SET
      ${setClauses.join(',\n      ')}
    WHERE id = ? AND branch_id = ? AND active = 1
    `,
    setValues,
  );

  // Keep payment_transaction consistent with payment_schedule.status
  await pool.query(`UPDATE payment_transaction SET active = 0 WHERE payment_schedule_id = ? AND active = 1`, [
    id,
  ]);

  if (payload.status === 'Paid') {
    const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
    await pool.query(
      `
      INSERT INTO payment_transaction (
        branch_id,
        payment_schedule_id,
        amount_paid,
        payment_date,
        payment_method,
        active
      ) VALUES (?, ?, ?, ?, ?, 1)
      `,
      [branchId, id, payload.amount, payload.paidDate ?? payload.dueDate, paymentMethod],
    );
  }

  emitBranchNotificationsChanged(branchId);
  return result.affectedRows;
}

export async function getPaymentById(id, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      ps.id,
      ps.branch_id,
      ps.contract_id,
      lc.unit_id,
      ps.amount_due AS amount,
      ps.due_date AS due_date,
      MAX(pt.payment_date) AS paid_date,
      CASE ps.status
        WHEN 'paid' THEN 'Paid'
        WHEN 'overdue' THEN 'Overdue'
        ELSE 'Pending'
      END AS status,
      ps.notes AS remarks,
      ${PAYMENT_METHOD_SUBQUERY}
    FROM payment_schedule ps
    JOIN lease_contract lc
      ON lc.id = ps.contract_id AND lc.branch_id = ps.branch_id AND lc.active = 1
    LEFT JOIN payment_transaction pt
      ON pt.payment_schedule_id = ps.id AND pt.active = 1
    WHERE ps.id = ? AND ps.branch_id = ? AND ps.active = 1
    GROUP BY ps.id, ps.branch_id, ps.contract_id, lc.unit_id, ps.amount_due, ps.due_date, ps.status, ps.notes
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function deletePaymentById(id, branchId) {
  await pool.query(`UPDATE payment_transaction SET active = 0 WHERE payment_schedule_id = ? AND active = 1`, [id]);
  const [result] = await pool.query(
    'UPDATE payment_schedule SET active = 0 WHERE id = ? AND branch_id = ? AND active = 1',
    [id, branchId],
  );
  emitBranchNotificationsChanged(branchId);
  return result.affectedRows;
}
