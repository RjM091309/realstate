import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from './db.js';
import { requireAuth, type AuthedRequest } from './authMiddleware.js';
import { loadSessionPayload, type SessionPayload } from './session.js';

const router = Router();
router.use(requireAuth);

type ContractRow = RowDataPacket & {
  id: string;
  branch_id: number;
  unit_id: string;
  tenant_id: string;
  agent_id: string;
  start_date: Date | string;
  end_date: Date | string;
  monthly_rent: number;
  security_deposit: number;
  advance_rent: number;
  contract_type: string;
  status: string;
  remarks: string | null;
};

function fmtDate(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rowToContract(row: ContractRow) {
  return {
    id: String(row.id),
    unitId: String(row.unit_id),
    tenantId: String(row.tenant_id),
    agentId: String(row.agent_id),
    startDate: fmtDate(row.start_date),
    endDate: fmtDate(row.end_date),
    monthlyRent: Number(row.monthly_rent),
    securityDeposit: Number(row.security_deposit),
    advanceRent: Number(row.advance_rent),
    type: String(row.contract_type),
    status: String(row.status),
    remarks: row.remarks ? String(row.remarks) : undefined,
  };
}

function canCrud(session: SessionPayload, op: 'create' | 'update' | 'delete'): boolean {
  const m = session.crud?.contracts;
  if (!m) return false;
  if (op === 'create') return Boolean(m.create);
  if (op === 'update') return Boolean(m.update);
  return Boolean(m.delete);
}

function validatePayload(body: Record<string, unknown>): {
  unitId: string;
  tenantId: string;
  agentId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  advanceRent: number;
  type: string;
  status: string;
  remarks: string | null;
} | null {
  const unitId = String(body.unitId ?? '').trim();
  const tenantId = String(body.tenantId ?? '').trim();
  const agentId = String(body.agentId ?? '').trim();
  const startDate = String(body.startDate ?? '').trim().slice(0, 10);
  const endDate = String(body.endDate ?? '').trim().slice(0, 10);
  const type = String(body.type ?? '').trim() || 'Monthly Rental';
  const status = String(body.status ?? '').trim() || 'Active';
  if (!unitId || !tenantId || !agentId || !startDate || !endDate) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;

  const monthlyRent = Number(body.monthlyRent);
  const securityDeposit = Number(body.securityDeposit);
  const advanceRent = Number(body.advanceRent ?? monthlyRent);
  if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) return null;
  if (!Number.isFinite(securityDeposit) || securityDeposit < 0) return null;
  if (!Number.isFinite(advanceRent) || advanceRent < 0) return null;

  const remarksRaw = body.remarks;
  const remarks =
    remarksRaw === null || remarksRaw === undefined ? null : String(remarksRaw).trim() || null;

  return {
    unitId,
    tenantId,
    agentId,
    startDate,
    endDate,
    monthlyRent,
    securityDeposit,
    advanceRent,
    type,
    status,
    remarks,
  };
}

router.get('/', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) return void res.status(401).json({ error: 'Unauthorized' });
  const session = await loadSessionPayload(userId);
  if (!session) return void res.status(401).json({ error: 'Unauthorized' });

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, branch_id, unit_id, tenant_id, agent_id, start_date, end_date,
              monthly_rent, security_deposit, advance_rent, contract_type, status, remarks
       FROM lease_contract
       WHERE branch_id = ?
       ORDER BY created_at DESC`,
      [session.branchId],
    );
    const contracts = (rows as ContractRow[]).map(rowToContract);
    res.json({ contracts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load contracts' });
  }
});

router.post('/', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) return void res.status(401).json({ error: 'Unauthorized' });
  const session = await loadSessionPayload(userId);
  if (!session) return void res.status(401).json({ error: 'Unauthorized' });
  if (!canCrud(session, 'create')) return void res.status(403).json({ error: 'No permission to create contracts' });

  const parsed = validatePayload(req.body as Record<string, unknown>);
  if (!parsed) return void res.status(400).json({ error: 'Invalid contract payload' });
  const id = crypto.randomUUID();

  try {
    await pool.query(
      `INSERT INTO lease_contract (
        id, branch_id, unit_id, tenant_id, agent_id, start_date, end_date,
        monthly_rent, security_deposit, advance_rent, contract_type, status, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        session.branchId,
        parsed.unitId,
        parsed.tenantId,
        parsed.agentId,
        parsed.startDate,
        parsed.endDate,
        parsed.monthlyRent,
        parsed.securityDeposit,
        parsed.advanceRent,
        parsed.type,
        parsed.status,
        parsed.remarks,
      ],
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, branch_id, unit_id, tenant_id, agent_id, start_date, end_date,
              monthly_rent, security_deposit, advance_rent, contract_type, status, remarks
       FROM lease_contract
       WHERE id = ? AND branch_id = ?
       LIMIT 1`,
      [id, session.branchId],
    );
    const row = (rows as ContractRow[])[0];
    if (!row) return void res.status(500).json({ error: 'Failed to load created contract' });
    res.status(201).json({ contract: rowToContract(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

router.patch('/:id', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) return void res.status(401).json({ error: 'Unauthorized' });
  const session = await loadSessionPayload(userId);
  if (!session) return void res.status(401).json({ error: 'Unauthorized' });
  if (!canCrud(session, 'update')) return void res.status(403).json({ error: 'No permission to update contracts' });
  const id = String(req.params.id ?? '').trim();
  if (!id) return void res.status(400).json({ error: 'Invalid id' });

  const parsed = validatePayload(req.body as Record<string, unknown>);
  if (!parsed) return void res.status(400).json({ error: 'Invalid contract payload' });

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE lease_contract SET
        unit_id = ?, tenant_id = ?, agent_id = ?, start_date = ?, end_date = ?,
        monthly_rent = ?, security_deposit = ?, advance_rent = ?, contract_type = ?, status = ?, remarks = ?
       WHERE id = ? AND branch_id = ?`,
      [
        parsed.unitId,
        parsed.tenantId,
        parsed.agentId,
        parsed.startDate,
        parsed.endDate,
        parsed.monthlyRent,
        parsed.securityDeposit,
        parsed.advanceRent,
        parsed.type,
        parsed.status,
        parsed.remarks,
        id,
        session.branchId,
      ],
    );
    if (result.affectedRows === 0) return void res.status(404).json({ error: 'Contract not found' });
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, branch_id, unit_id, tenant_id, agent_id, start_date, end_date,
              monthly_rent, security_deposit, advance_rent, contract_type, status, remarks
       FROM lease_contract
       WHERE id = ? AND branch_id = ?
       LIMIT 1`,
      [id, session.branchId],
    );
    const row = (rows as ContractRow[])[0];
    if (!row) return void res.status(404).json({ error: 'Contract not found' });
    res.json({ contract: rowToContract(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update contract' });
  }
});

router.delete('/:id', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) return void res.status(401).json({ error: 'Unauthorized' });
  const session = await loadSessionPayload(userId);
  if (!session) return void res.status(401).json({ error: 'Unauthorized' });
  if (!canCrud(session, 'delete')) return void res.status(403).json({ error: 'No permission to delete contracts' });
  const id = String(req.params.id ?? '').trim();
  if (!id) return void res.status(400).json({ error: 'Invalid id' });

  try {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM lease_contract WHERE id = ? AND branch_id = ?',
      [id, session.branchId],
    );
    if (result.affectedRows === 0) return void res.status(404).json({ error: 'Contract not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete contract' });
  }
});

export { router as contractsRouter };

