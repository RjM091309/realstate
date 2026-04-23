import { pool } from '../config/db.js';

export async function listInvoicesByContract(contractId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      i.id,
      i.branch_id,
      i.invoice_no,
      i.contract_id,
      i.billing_period_start,
      i.billing_period_end,
      i.due_date,
      i.base_amount,
      i.other_charges,
      i.discount_amount,
      i.total_amount,
      i.status,
      i.issued_at,
      i.created_by,
      i.created_at
    FROM invoice i
    WHERE i.branch_id = ?
      AND i.contract_id = ?
    ORDER BY i.created_at DESC, i.id DESC
    `,
    [branchId, contractId],
  );
  return rows;
}

export async function getInvoiceById(id, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      i.id,
      i.branch_id,
      i.invoice_no,
      i.contract_id,
      i.billing_period_start,
      i.billing_period_end,
      i.due_date,
      i.base_amount,
      i.other_charges,
      i.discount_amount,
      i.total_amount,
      i.status,
      i.issued_at,
      i.created_by,
      i.created_at
    FROM invoice i
    WHERE i.branch_id = ?
      AND i.id = ?
    LIMIT 1
    `,
    [branchId, id],
  );
  return rows[0] ?? null;
}

export async function insertInvoice(branchId, payload) {
  const [res] = await pool.query(
    `
    INSERT INTO invoice (
      branch_id,
      invoice_no,
      contract_id,
      billing_period_start,
      billing_period_end,
      due_date,
      base_amount,
      other_charges,
      discount_amount,
      total_amount,
      status,
      issued_at,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      branchId,
      payload.invoiceNo,
      payload.contractId,
      payload.billingPeriodStart,
      payload.billingPeriodEnd,
      payload.dueDate,
      payload.baseAmount,
      payload.otherCharges,
      payload.discountAmount,
      payload.totalAmount,
      payload.status,
      payload.issuedAt ?? null,
      payload.createdBy ?? null,
    ],
  );
  return res.insertId;
}

export async function updateInvoiceStatusById(id, branchId, payload) {
  const [result] = await pool.query(
    `
    UPDATE invoice
    SET status = ?,
        issued_at = COALESCE(issued_at, ?)
    WHERE id = ? AND branch_id = ?
    `,
    [payload.status, payload.issuedAt ?? null, id, branchId],
  );
  return result.affectedRows;
}

