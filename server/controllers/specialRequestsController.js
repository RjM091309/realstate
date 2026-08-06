import { loadSessionPayload } from '../services/sessionService.js';
import {
  getSpecialRequestById,
  insertSpecialRequest,
  listSpecialRequestsByBranch,
  listSpecialRequestsByContract,
  updateSpecialRequestStatus,
} from '../models/specialRequestsModel.js';
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

const VALID_STATUSES = new Set(['open', 'in_progress', 'resolved', 'cancelled']);

function mapRequestRow(r) {
  const tower = r.unit_tower ? `${r.unit_tower} · ` : '';
  const unitLabel = `${tower}${r.unit_number ?? ''}`.trim() || '—';
  return {
    id: String(r.id),
    contractId: String(r.contract_id),
    contractNo: String(r.contract_no ?? ''),
    unitLabel,
    buildingName: String(r.building_name ?? ''),
    tenantName: String(r.tenant_name ?? '').trim() || '—',
    requestSource: String(r.request_source ?? 'tenant'),
    title: String(r.title),
    details: String(r.details),
    status: String(r.status),
    createdBy: r.created_by != null ? String(r.created_by) : null,
    createdAt: r.created_at ? fmtDate(r.created_at) : '',
    updatedAt: r.updated_at ? fmtDate(r.updated_at) : '',
  };
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
    const requests = rows.map(mapRequestRow);
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
    const requests = rows.map(mapRequestRow);
    res.status(201).json({ requests });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to submit maintenance request' });
  }
}

export async function listBranchSpecialRequests(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const rows = await listSpecialRequestsByBranch(ctx.session.branchId);
    res.json({ requests: rows.map(mapRequestRow) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load maintenance requests' });
  }
}

export async function patchSpecialRequestStatus(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;

  const crud = ctx.session.crud?.maintenance;
  if (!crud?.update) {
    res.status(403).json({ error: 'You do not have permission to update maintenance tickets' });
    return;
  }

  const id = String(req.params.id ?? '').trim();
  const status = String(req.body?.status ?? '').trim();
  if (!id || !VALID_STATUSES.has(status)) {
    res.status(400).json({ error: 'Invalid request payload' });
    return;
  }

  try {
    const existing = await getSpecialRequestById(id, ctx.session.branchId);
    if (!existing) {
      res.status(404).json({ error: 'Maintenance request not found' });
      return;
    }

    const affected = await updateSpecialRequestStatus(id, ctx.session.branchId, status);
    if (!affected) {
      res.status(404).json({ error: 'Maintenance request not found' });
      return;
    }

    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'maintenance',
      recordTable: 'special_request',
      recordId: id,
      action: 'update',
      changeSummary: `Updated maintenance ticket #${id} status to ${status.replace(/_/g, ' ')}`,
    });

    const updated = await getSpecialRequestById(id, ctx.session.branchId);
    res.json({ request: mapRequestRow(updated) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update maintenance request' });
  }
}

