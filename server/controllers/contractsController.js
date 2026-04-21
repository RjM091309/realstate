import { loadSessionPayload } from '../services/sessionService.js';
import {
  deleteContractById,
  getContractById,
  insertContract,
  listContractsByBranch,
  updateContractById,
} from '../models/contractsModel.js';

function fmtDate(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** DB ENUM contract_type (see lease_contract in realstate_init.sql) */
const DB_CONTRACT_TYPES = new Set(['monthly_rental', 'selling', 'short_term_rental']);
/** DB ENUM status */
const DB_CONTRACT_STATUSES = new Set(['draft', 'active', 'completed', 'terminated', 'cancelled']);

const UI_TYPE_TO_DB = {
  'Monthly Rental': 'monthly_rental',
  Sales: 'selling',
  'Short-term Rental': 'short_term_rental',
};

const DB_TO_UI_TYPE = {
  monthly_rental: 'Monthly Rental',
  selling: 'Sales',
  short_term_rental: 'Short-term Rental',
};

const UI_STATUS_TO_DB = {
  Active: 'active',
  Expired: 'completed',
  Terminated: 'terminated',
};

const DB_TO_UI_STATUS = {
  draft: 'Active',
  active: 'Active',
  completed: 'Expired',
  terminated: 'Terminated',
  cancelled: 'Terminated',
};

function mapUiTypeToDb(type) {
  const t = String(type ?? '').trim();
  if (DB_CONTRACT_TYPES.has(t)) return t;
  return UI_TYPE_TO_DB[t] ?? 'monthly_rental';
}

function mapDbTypeToUi(type) {
  const t = String(type ?? '').trim();
  return DB_TO_UI_TYPE[t] ?? 'Monthly Rental';
}

function mapUiStatusToDb(status) {
  const s = String(status ?? '').trim();
  if (DB_CONTRACT_STATUSES.has(s)) return s;
  return UI_STATUS_TO_DB[s] ?? 'active';
}

function mapDbStatusToUi(status) {
  const s = String(status ?? '').trim().toLowerCase();
  return DB_TO_UI_STATUS[s] ?? 'Active';
}

/** Accepts UI ids like "a12" or numeric "12"; returns numeric string for FK to user_info.IDNO */
function normalizeAgentId(raw) {
  const s = String(raw ?? '').trim();
  const prefixed = s.match(/^a(\d+)$/i);
  if (prefixed) return prefixed[1];
  if (/^\d+$/.test(s)) return s;
  const digits = s.replace(/\D/g, '');
  return digits || '';
}

function rowToContract(row) {
  const aid = row.agent_id != null && String(row.agent_id).trim() !== '' ? String(row.agent_id) : '';
  const start = fmtDate(row.start_date);
  const ym = /^\d{4}-\d{2}-\d{2}$/.test(start) ? start.slice(0, 7).replace('-', '') : '';
  const idPad = String(row.id ?? '').replace(/\D/g, '').padStart(4, '0');
  const normalized =
    ym && idPad ? `${ym}-${idPad}` : row.contract_no ? String(row.contract_no) : undefined;
  return {
    id: String(row.id),
    contractNo: normalized,
    unitId: String(row.unit_id),
    tenantId: String(row.tenant_id),
    agentId: aid ? `a${aid}` : '',
    startDate: start,
    endDate: fmtDate(row.end_date),
    monthlyRent: Number(row.monthly_rent),
    securityDeposit: Number(row.security_deposit),
    advanceRent: Number(row.advance_rent),
    type: mapDbTypeToUi(row.contract_type),
    status: mapDbStatusToUi(row.status),
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

  const agentDigits = normalizeAgentId(agentId);
  if (!agentDigits) return null;

  return {
    unitId,
    tenantId,
    agentId: agentDigits,
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

/** Maps validated payload to DB column values (ENUMs + numeric agent id). */
function payloadForDatabase(parsed) {
  return {
    ...parsed,
    type: mapUiTypeToDb(parsed.type),
    status: mapUiStatusToDb(parsed.status),
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
  const dbPayload = payloadForDatabase(parsed);
  try {
    const row = await insertContract(ctx.session.branchId, dbPayload);
    if (!row) {
      res.status(500).json({ error: 'Failed to load created contract' });
      return;
    }
    res.status(201).json({ contract: rowToContract(row) });
  } catch (e) {
    console.error(e);
    // Common MySQL constraint errors → return a clear client message.
    if (e?.code === 'ER_NO_REFERENCED_ROW_2' || e?.code === 'ER_NO_REFERENCED_ROW') {
      res.status(400).json({
        error:
          'Invalid unit/tenant/agent reference. Make sure you selected an existing unit and tenant, and that your user account exists.',
      });
      return;
    }
    if (e?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'A contract with the same key already exists.' });
      return;
    }
    const showDetail = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      error: 'Failed to create contract',
      ...(showDetail
        ? {
            detail:
              typeof e?.sqlMessage === 'string'
                ? e.sqlMessage
                : e instanceof Error
                  ? e.message
                  : String(e),
            code: typeof e?.code === 'string' ? e.code : undefined,
          }
        : null),
    });
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
  const dbPayload = payloadForDatabase(parsed);
  try {
    const affectedRows = await updateContractById(id, ctx.session.branchId, dbPayload);
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
