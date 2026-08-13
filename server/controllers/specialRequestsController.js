import { loadSessionPayload } from '../services/sessionService.js';
import {
  getSpecialRequestById,
  insertSpecialRequest,
  listSpecialRequestsByBranch,
  listSpecialRequestsByContract,
  updateSpecialRequestCosts,
  updateSpecialRequestStatus,
} from '../models/specialRequestsModel.js';
import { logAudit } from '../services/auditLogService.js';
import { getVendorById } from '../models/vendorsModel.js';

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
    vendorId: r.vendor_id != null ? String(r.vendor_id) : null,
    vendorName: r.vendor_name ? String(r.vendor_name) : null,
    estimatedCost: r.estimated_cost != null ? Number(r.estimated_cost) : null,
    actualCost: r.actual_cost != null ? Number(r.actual_cost) : null,
    resolvedAt: r.resolved_at ? fmtDate(r.resolved_at) : null,
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

function parseOptionalCost(raw) {
  if (raw === undefined) return { present: false, value: undefined };
  if (raw === null || raw === '') return { present: true, value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return { present: true, value: undefined, invalid: true };
  return { present: true, value: Math.round(n * 100) / 100 };
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
  if (!id) {
    res.status(400).json({ error: 'Invalid request payload' });
    return;
  }

  const hasStatus = req.body?.status !== undefined;
  const status = hasStatus ? String(req.body.status).trim() : null;
  if (hasStatus && !VALID_STATUSES.has(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const hasVendorId = req.body?.vendorId !== undefined;
  const vendorId = hasVendorId ? (req.body.vendorId === null || req.body.vendorId === '' ? null : String(req.body.vendorId).trim()) : undefined;
  const estimated = parseOptionalCost(req.body?.estimatedCost);
  const actual = parseOptionalCost(req.body?.actualCost);
  if (estimated.invalid || actual.invalid) {
    res.status(400).json({ error: 'Cost must be a non-negative number' });
    return;
  }
  const hasCosts = hasVendorId || estimated.present || actual.present;

  if (!hasStatus && !hasCosts) {
    res.status(400).json({ error: 'Invalid request payload' });
    return;
  }

  try {
    const existing = await getSpecialRequestById(id, ctx.session.branchId);
    if (!existing) {
      res.status(404).json({ error: 'Maintenance request not found' });
      return;
    }

    if (hasVendorId && vendorId) {
      const vendor = await getVendorById(vendorId, ctx.session.branchId);
      if (!vendor) {
        res.status(400).json({ error: 'Vendor not found' });
        return;
      }
    }

    if (hasStatus) {
      await updateSpecialRequestStatus(id, ctx.session.branchId, status);
    }
    if (hasCosts) {
      await updateSpecialRequestCosts(id, ctx.session.branchId, {
        vendorId: hasVendorId ? vendorId : existing.vendor_id,
        estimatedCost: estimated.present ? estimated.value : existing.estimated_cost,
        actualCost: actual.present ? actual.value : existing.actual_cost,
      });
    }

    const summaryParts = [];
    if (hasStatus) summaryParts.push(`status to ${status.replace(/_/g, ' ')}`);
    if (hasCosts) summaryParts.push('vendor/cost details');
    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'maintenance',
      recordTable: 'special_request',
      recordId: id,
      action: 'update',
      changeSummary: `Updated maintenance ticket #${id}: ${summaryParts.join(', ')}`,
    });

    const updated = await getSpecialRequestById(id, ctx.session.branchId);
    res.json({ request: mapRequestRow(updated) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update maintenance request' });
  }
}

