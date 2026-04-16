import { loadSessionPayload } from '../services/sessionService.js';
import {
  deleteContractById,
  getContractById,
  insertContract,
  listContractsByBranch,
  updateContractById,
} from '../models/contractsModel.js';

function fmtDate(d) {
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rowToContract(row) {
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

function validatePayload(body) {
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

function canCrud(session, op) {
  const permissions = session.crud?.contracts;
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

export async function listContracts(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const rows = await listContractsByBranch(ctx.session.branchId);
    res.json({ contracts: rows.map(rowToContract) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load contracts' });
  }
}

export async function createContract(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to create contracts' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid contract payload' });
    return;
  }
  try {
    const row = await insertContract(ctx.session.branchId, parsed);
    if (!row) {
      res.status(500).json({ error: 'Failed to load created contract' });
      return;
    }
    res.status(201).json({ contract: rowToContract(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create contract' });
  }
}

export async function updateContract(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update contracts' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid contract payload' });
    return;
  }
  try {
    const affectedRows = await updateContractById(id, ctx.session.branchId, parsed);
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    const row = await getContractById(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    res.json({ contract: rowToContract(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update contract' });
  }
}

export async function deleteContract(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete contracts' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const affectedRows = await deleteContractById(id, ctx.session.branchId);
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete contract' });
  }
}
