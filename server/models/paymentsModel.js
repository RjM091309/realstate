import { pool } from '../config/db.js';

const STATUS_MAP_TO_SCHEDULE = {
  Paid: 'paid',
  Overdue: 'overdue',
  Pending: 'pending',
};

function mapToScheduleStatus(appStatus) {
  return STATUS_MAP_TO_SCHEDULE[appStatus] ?? 'pending';
}

export async function listPaymentsByBranch(branchId) {
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
      END AS status
    FROM payment_schedule ps
    JOIN lease_contract lc
      ON lc.id = ps.contract_id AND lc.branch_id = ps.branch_id
    LEFT JOIN payment_transaction pt
      ON pt.payment_schedule_id = ps.id
    WHERE ps.branch_id = ?
    GROUP BY ps.id, ps.branch_id, ps.contract_id, lc.unit_id, ps.amount_due, ps.due_date, ps.status
    ORDER BY ps.due_date DESC, ps.created_at DESC
    `,
    [branchId],
  );
  return rows;
}

export async function insertPayment(branchId, payload) {
  const [contractRows] = await pool.query(
    `SELECT id FROM lease_contract WHERE id = ? AND branch_id = ? LIMIT 1`,
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
      status
    ) VALUES (?, ?, ?, ?, ?)
    `,
    [branchId, payload.contractId, payload.dueDate, payload.amount, mapToScheduleStatus(payload.status)],
  );

  const scheduleId = res.insertId;

  if (payload.status === 'Paid') {
    await pool.query(
      `
      INSERT INTO payment_transaction (
        branch_id,
        payment_schedule_id,
        amount_paid,
        payment_date,
        payment_method
      ) VALUES (?, ?, ?, ?, 'cash')
      `,
      [branchId, scheduleId, payload.amount, payload.paidDate ?? payload.dueDate],
    );
  }

  return getPaymentById(scheduleId, branchId);
}

export async function updatePaymentById(id, branchId, payload) {
  const [rows] = await pool.query(
    `
    SELECT ps.id
    FROM payment_schedule ps
    WHERE ps.id = ? AND ps.branch_id = ?
    LIMIT 1
    `,
    [id, branchId],
  );
  if (!rows[0]?.id) return 0;

  const scheduleStatus = mapToScheduleStatus(payload.status);

  const [result] = await pool.query(
    `
    UPDATE payment_schedule
    SET
      amount_due = ?,
      due_date = ?,
      status = ?
    WHERE id = ? AND branch_id = ?
    `,
    [payload.amount, payload.dueDate, scheduleStatus, id, branchId],
  );

  // Keep payment_transaction consistent with payment_schedule.status
  await pool.query(`DELETE FROM payment_transaction WHERE payment_schedule_id = ?`, [id]);

  if (payload.status === 'Paid') {
    await pool.query(
      `
      INSERT INTO payment_transaction (
        branch_id,
        payment_schedule_id,
        amount_paid,
        payment_date,
        payment_method
      ) VALUES (?, ?, ?, ?, 'cash')
      `,
      [branchId, id, payload.amount, payload.paidDate ?? payload.dueDate],
    );
  }

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
      END AS status
    FROM payment_schedule ps
    JOIN lease_contract lc
      ON lc.id = ps.contract_id AND lc.branch_id = ps.branch_id
    LEFT JOIN payment_transaction pt
      ON pt.payment_schedule_id = ps.id
    WHERE ps.id = ? AND ps.branch_id = ?
    GROUP BY ps.id, ps.branch_id, ps.contract_id, lc.unit_id, ps.amount_due, ps.due_date, ps.status
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function deletePaymentById(id, branchId) {
  await pool.query(`DELETE FROM payment_transaction WHERE payment_schedule_id = ?`, [id]);
  const [result] = await pool.query(
    'DELETE FROM payment_schedule WHERE id = ? AND branch_id = ?',
    [id, branchId],
  );
  return result.affectedRows;
}
