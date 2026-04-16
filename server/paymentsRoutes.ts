import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from './db.js';
import { requireAuth, type AuthedRequest } from './authMiddleware.js';
import { loadSessionPayload, type SessionPayload } from './session.js';

const router = Router();
router.use(requireAuth);

type PaymentRow = RowDataPacket & {
  id: string;
  branch_id: number;
  contract_id: string;
  unit_id: string;
  amount: number;
  due_date: Date | string;
  paid_date: Date | string | null;
  status: string;
};

function fmtDate(d: Date | string | null): string | undefined {
  if (d == null) return undefined;
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rowToPayment(row: PaymentRow) {
  return {
    id: String(row.id),
    contractId: String(row.contract_id),
    unitId: String(row.unit_id),
    amount: Number(row.amount),
    dueDate: fmtDate(row.due_date) ?? '',
    paidDate: fmtDate(row.paid_date),
    status: String(row.status) as 'Paid' | 'Overdue' | 'Pending',
  };
}

function canCrud(session: SessionPayload, op: 'create' | 'update' | 'delete'): boolean {
  const m = session.crud?.ledger;
  if (!m) return false;
  if (op === 'create') return Boolean(m.create);
  if (op === 'update') return Boolean(m.update);
  return Boolean(m.delete);
}

function validatePayload(body: Record<string, unknown>): {
  contractId: string;
  unitId: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: 'Paid' | 'Overdue' | 'Pending';
} | null {
  const contractId = String(body.contractId ?? '').trim();
  const unitId = String(body.unitId ?? '').trim();
  const dueDate = String(body.dueDate ?? '').trim().slice(0, 10);
  const status = String(body.status ?? '').trim() as 'Paid' | 'Overdue' | 'Pending';
  if (!contractId || !unitId || !dueDate || !['Paid', 'Overdue', 'Pending'].includes(status)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const paidRaw = body.paidDate;
  let paidDate: string | null = null;
  if (paidRaw != null && String(paidRaw).trim() !== '') {
    const s = String(paidRaw).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    paidDate = s;
  }
  if (status === 'Paid' && !paidDate) paidDate = dueDate;

  return { contractId, unitId, amount, dueDate, paidDate, status };
}

router.get('/', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) return void res.status(401).json({ error: 'Unauthorized' });
  const session = await loadSessionPayload(userId);
  if (!session) return void res.status(401).json({ error: 'Unauthorized' });
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, branch_id, contract_id, unit_id, amount, due_date, paid_date, status
       FROM payment_collection
       WHERE branch_id = ?
       ORDER BY due_date DESC, created_at DESC`,
      [session.branchId],
    );
    const payments = (rows as PaymentRow[]).map(rowToPayment);
    res.json({ payments });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load payments' });
  }
});

router.post('/', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) return void res.status(401).json({ error: 'Unauthorized' });
  const session = await loadSessionPayload(userId);
  if (!session) return void res.status(401).json({ error: 'Unauthorized' });
  if (!canCrud(session, 'create')) return void res.status(403).json({ error: 'No permission to create payments' });

  const parsed = validatePayload(req.body as Record<string, unknown>);
  if (!parsed) return void res.status(400).json({ error: 'Invalid payment payload' });

  const id = crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO payment_collection (
        id, branch_id, contract_id, unit_id, amount, due_date, paid_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        session.branchId,
        parsed.contractId,
        parsed.unitId,
        parsed.amount,
        parsed.dueDate,
        parsed.paidDate,
        parsed.status,
      ],
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, branch_id, contract_id, unit_id, amount, due_date, paid_date, status
       FROM payment_collection
       WHERE id = ? AND branch_id = ?
       LIMIT 1`,
      [id, session.branchId],
    );
    const row = (rows as PaymentRow[])[0];
    if (!row) return void res.status(500).json({ error: 'Failed to load created payment' });
    res.status(201).json({ payment: rowToPayment(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

router.patch('/:id', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) return void res.status(401).json({ error: 'Unauthorized' });
  const session = await loadSessionPayload(userId);
  if (!session) return void res.status(401).json({ error: 'Unauthorized' });
  if (!canCrud(session, 'update')) return void res.status(403).json({ error: 'No permission to update payments' });
  const id = String(req.params.id ?? '').trim();
  if (!id) return void res.status(400).json({ error: 'Invalid id' });

  const parsed = validatePayload(req.body as Record<string, unknown>);
  if (!parsed) return void res.status(400).json({ error: 'Invalid payment payload' });

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE payment_collection SET
        contract_id = ?, unit_id = ?, amount = ?, due_date = ?, paid_date = ?, status = ?
       WHERE id = ? AND branch_id = ?`,
      [
        parsed.contractId,
        parsed.unitId,
        parsed.amount,
        parsed.dueDate,
        parsed.paidDate,
        parsed.status,
        id,
        session.branchId,
      ],
    );
    if (result.affectedRows === 0) return void res.status(404).json({ error: 'Payment not found' });
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, branch_id, contract_id, unit_id, amount, due_date, paid_date, status
       FROM payment_collection
       WHERE id = ? AND branch_id = ?
       LIMIT 1`,
      [id, session.branchId],
    );
    const row = (rows as PaymentRow[])[0];
    if (!row) return void res.status(404).json({ error: 'Payment not found' });
    res.json({ payment: rowToPayment(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

router.delete('/:id', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) return void res.status(401).json({ error: 'Unauthorized' });
  const session = await loadSessionPayload(userId);
  if (!session) return void res.status(401).json({ error: 'Unauthorized' });
  if (!canCrud(session, 'delete')) return void res.status(403).json({ error: 'No permission to delete payments' });
  const id = String(req.params.id ?? '').trim();
  if (!id) return void res.status(400).json({ error: 'Invalid id' });
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM payment_collection WHERE id = ? AND branch_id = ?',
      [id, session.branchId],
    );
    if (result.affectedRows === 0) return void res.status(404).json({ error: 'Payment not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

export { router as paymentsRouter };

