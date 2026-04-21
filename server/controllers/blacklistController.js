import { loadSessionPayload } from '../services/sessionService.js';
import {
  getBlacklistRowById,
  insertBlacklistRecord,
  listActiveBlacklistByBranch,
} from '../models/blacklistModel.js';

function fmtDate(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rowToBlacklist(row) {
  const entityType = String(row.entity_type);
  const type = entityType === 'landlord' ? 'Landlord' : 'Tenant';
  const name =
    entityType === 'landlord'
      ? String(row.landlord_name ?? '').trim()
      : String(row.tenant_name ?? '').trim();

  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    entityType: entityType === 'landlord' ? 'landlord' : 'tenant',
    tenantId: row.tenant_id != null ? String(row.tenant_id) : undefined,
    landlordId: row.landlord_id != null ? String(row.landlord_id) : undefined,
    name: name || '—',
    type,
    reason: String(row.reason ?? ''),
    details: row.details ? String(row.details) : undefined,
    taggedBy: row.tagged_by != null ? String(row.tagged_by) : undefined,
    date: row.tagged_at ? fmtDate(row.tagged_at) : '',
  };
}

function validateCreate(body) {
  const entityTypeRaw = String(body.entityType ?? '').trim().toLowerCase();
  if (entityTypeRaw !== 'tenant' && entityTypeRaw !== 'landlord') return null;

  const reason = String(body.reason ?? '').trim();
  if (!reason) return null;

  const tenantIdRaw = body.tenantId;
  const landlordIdRaw = body.landlordId;

  const tenantId =
    tenantIdRaw === null || tenantIdRaw === undefined || String(tenantIdRaw).trim() === ''
      ? null
      : String(tenantIdRaw).trim();
  const landlordId =
    landlordIdRaw === null || landlordIdRaw === undefined || String(landlordIdRaw).trim() === ''
      ? null
      : String(landlordIdRaw).trim();

  if (entityTypeRaw === 'tenant' && !tenantId) return null;
  if (entityTypeRaw === 'landlord' && !landlordId) return null;
  if (entityTypeRaw === 'tenant' && landlordId) return null;
  if (entityTypeRaw === 'landlord' && tenantId) return null;

  const detailsRaw = body.details;
  const details =
    detailsRaw === null || detailsRaw === undefined ? null : String(detailsRaw).trim() || null;

  return { entityType: entityTypeRaw, tenantId, landlordId, reason, details };
}

function canCrud(session, op) {
  const permissions = session.crud?.crm;
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

export async function listBlacklist(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const rows = await listActiveBlacklistByBranch(ctx.session.branchId);
    res.json({ blacklist: rows.map(rowToBlacklist) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load blacklist' });
  }
}

export async function createBlacklist(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to create blacklist records' });
    return;
  }

  const parsed = validateCreate(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid blacklist payload' });
    return;
  }

  try {
    const id = await insertBlacklistRecord(ctx.session.branchId, {
      entityType: parsed.entityType,
      tenantId: parsed.tenantId,
      landlordId: parsed.landlordId,
      reason: parsed.reason,
      details: parsed.details,
      taggedBy: ctx.session.user.id,
    });

    const created = await getBlacklistRowById(id, ctx.session.branchId);
    if (!created) {
      res.status(500).json({ error: 'Failed to load created blacklist record' });
      return;
    }
    res.status(201).json({ record: rowToBlacklist(created) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create blacklist record' });
  }
}
