import { loadSessionPayload } from '../services/sessionService.js';
import { insertSpecialRequest, listSpecialRequestsByContract } from '../models/specialRequestsModel.js';
import { logAudit } from '../services/auditLogService.js';

function fmtDate(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d.slice(0, 19).replace('T', ' ');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
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

function validateCreate(body) {
  const title = String(body?.title ?? '').trim();
  const details = String(body?.details ?? '').trim();
  if (!title || !details) return null;
  if (title.length > 180) return null;
  return { title, details };
}

export async function listContractSpecialRequests(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const contractId = String(req.params.contractId ?? '').trim();
  if (!contractId) {
    res.status(400).json({ error: 'Invalid contract id' });
    return;
  }
  try {
    const rows = await listSpecialRequestsByContract(contractId, ctx.session.branchId);
    const requests = rows.map((r) => ({
      id: String(r.id),
      contractId: String(r.contract_id),
      title: String(r.title),
      details: String(r.details),
      status: String(r.status),
      createdAt: r.created_at ? fmtDate(r.created_at) : '',
      updatedAt: r.updated_at ? fmtDate(r.updated_at) : '',
    }));
    res.json({ requests });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load maintenance requests' });
  }
}

export async function createContractSpecialRequest(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const contractId = String(req.params.contractId ?? '').trim();
  if (!contractId) {
    res.status(400).json({ error: 'Invalid contract id' });
    return;
  }
  const parsed = validateCreate(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid request payload' });
    return;
  }
  try {
    const id = await insertSpecialRequest(ctx.session.branchId, contractId, {
      title: parsed.title,
      details: parsed.details,
      createdBy: ctx.session.user.id,
    });

    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'operations',
      recordTable: 'special_request',
      recordId: id,
      action: 'create',
      changeSummary: `Created special request: ${parsed.title}`,
    });
    const rows = await listSpecialRequestsByContract(contractId, ctx.session.branchId);
    const requests = rows.map((r) => ({
      id: String(r.id),
      contractId: String(r.contract_id),
      title: String(r.title),
      details: String(r.details),
      status: String(r.status),
      createdAt: r.created_at ? fmtDate(r.created_at) : '',
      updatedAt: r.updated_at ? fmtDate(r.updated_at) : '',
    }));
    res.status(201).json({ requests });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to submit maintenance request' });
  }
}

