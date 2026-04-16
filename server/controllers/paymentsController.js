import { loadSessionPayload } from '../services/sessionService.js';
import {
  deletePaymentById,
  getPaymentById,
  insertPayment,
  listPaymentsByBranch,
  updatePaymentById,
} from '../models/paymentsModel.js';

function fmtDate(d) {
  if (d == null) return undefined;
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rowToPayment(row) {
  return {
    id: String(row.id),
    contractId: String(row.contract_id),
    unitId: String(row.unit_id),
    amount: Number(row.amount),
    dueDate: fmtDate(row.due_date) ?? '',
    paidDate: fmtDate(row.paid_date),
    status: String(row.status),
  };
}

function validatePayload(body) {
  const contractId = String(body.contractId ?? '').trim();
  const unitId = String(body.unitId ?? '').trim();
  const dueDate = String(body.dueDate ?? '').trim().slice(0, 10);
  const status = String(body.status ?? '').trim();
  if (!contractId || !unitId || !dueDate || !['Paid', 'Overdue', 'Pending'].includes(status)) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const paidRaw = body.paidDate;
  let paidDate = null;
  if (paidRaw != null && String(paidRaw).trim() !== '') {
    const value = String(paidRaw).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    paidDate = value;
  }
  if (status === 'Paid' && !paidDate) paidDate = dueDate;

  return { contractId, unitId, amount, dueDate, paidDate, status };
}

function canCrud(session, op) {
  const permissions = session.crud?.ledger;
  if (!permissions) return false;
  if (op === 'create') return Boolean(permissions.create);
  if (op === 'update') return Boolean(permissions.update);
  return Boolean(permissions.delete);
}

async function getAuthContext(req, res) {
  const userId = req.userId;
  if (userId == null) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { session };
}

export async function listPayments(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const rows = await listPaymentsByBranch(ctx.session.branchId);
    res.json({ payments: rows.map(rowToPayment) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load payments' });
  }
}

export async function createPayment(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to create payments' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid payment payload' });
    return;
  }
  try {
    const row = await insertPayment(ctx.session.branchId, parsed);
    if (!row) throw new Error('Failed to load created payment');
    res.status(201).json({ payment: rowToPayment(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create payment' });
  }
}

export async function updatePayment(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update payments' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid payment payload' });
    return;
  }
  try {
    const affectedRows = await updatePaymentById(id, ctx.session.branchId, parsed);
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }
    const row = await getPaymentById(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }
    res.json({ payment: rowToPayment(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update payment' });
  }
}

export async function deletePayment(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete payments' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const affectedRows = await deletePaymentById(id, ctx.session.branchId);
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
}
