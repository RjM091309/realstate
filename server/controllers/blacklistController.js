import { loadSessionPayload } from '../services/sessionService.js';
import {
  getBlacklistRowById,
  clearBrokerBlacklistState,
  clearTenantBlacklistState,
  insertBlacklistRecord,
  listActiveBlacklistByBranch,
  tagBrokerPartnerAgencyBlacklist,
} from '../models/blacklistModel.js';
import { getPartnerAgencyById } from '../models/partnerAgenciesModel.js';
import { getTenantById } from '../models/tenantsModel.js';

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
  const type = entityType === 'tenant' ? 'Tenant' : 'Broker';
  const name =
    entityType === 'broker'
      ? String(row.partner_agency_name ?? '').trim()
      : entityType === 'landlord'
        ? String(row.landlord_name ?? '').trim()
        : String(row.tenant_name ?? '').trim();

  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    entityType: entityType === 'broker' ? 'broker' : entityType === 'landlord' ? 'landlord' : 'tenant',
    tenantId: row.tenant_id != null ? String(row.tenant_id) : undefined,
    landlordId: row.landlord_id != null ? String(row.landlord_id) : undefined,
    partnerAgencyId: row.partner_agency_id != null ? String(row.partner_agency_id) : undefined,
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
  if (entityTypeRaw !== 'tenant' && entityTypeRaw !== 'landlord' && entityTypeRaw !== 'broker') return null;

  const reason = String(body.reason ?? '').trim();
  if (!reason) return null;

  const tenantIdRaw = body.tenantId;
  const landlordIdRaw = body.landlordId;
  const partnerAgencyIdRaw = body.partnerAgencyId;

  const tenantId =
    tenantIdRaw === null || tenantIdRaw === undefined || String(tenantIdRaw).trim() === ''
      ? null
      : String(tenantIdRaw).trim();
  const landlordId =
    landlordIdRaw === null || landlordIdRaw === undefined || String(landlordIdRaw).trim() === ''
      ? null
      : String(landlordIdRaw).trim();
  const partnerAgencyId =
    partnerAgencyIdRaw === null || partnerAgencyIdRaw === undefined || String(partnerAgencyIdRaw).trim() === ''
      ? null
      : String(partnerAgencyIdRaw).trim();

  if (entityTypeRaw === 'tenant' && !tenantId) return null;
  if (entityTypeRaw === 'landlord' && !landlordId) return null;
  if (entityTypeRaw === 'broker' && !partnerAgencyId) return null;
  if (entityTypeRaw === 'tenant' && (landlordId || partnerAgencyId)) return null;
  if (entityTypeRaw === 'landlord' && (tenantId || partnerAgencyId)) return null;
  if (entityTypeRaw === 'broker' && (tenantId || landlordId)) return null;

  const detailsRaw = body.details;
  const details =
    detailsRaw === null || detailsRaw === undefined ? null : String(detailsRaw).trim() || null;

  return { entityType: entityTypeRaw, tenantId, landlordId, partnerAgencyId, reason, details };
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
    if (parsed.entityType === 'broker') {
      const id = await tagBrokerPartnerAgencyBlacklist(
        ctx.session.branchId,
        parsed.partnerAgencyId,
        parsed.reason,
        ctx.session.user.id,
      );
      const created = await getBlacklistRowById(id, ctx.session.branchId);
      if (!created) {
        res.status(500).json({ error: 'Failed to load created blacklist record' });
        return;
      }
      res.status(201).json({ record: rowToBlacklist(created) });
      return;
    }

    const id = await insertBlacklistRecord(ctx.session.branchId, {
      entityType: parsed.entityType,
      tenantId: parsed.tenantId,
      landlordId: parsed.landlordId,
      partnerAgencyId: parsed.partnerAgencyId,
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

export async function removeTenantFromBlacklist(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update blacklist records' });
    return;
  }

  const tenantId = String(req.params.tenantId ?? '').trim();
  if (!tenantId) {
    res.status(400).json({ error: 'Invalid tenantId' });
    return;
  }

  try {
    const tenant = await getTenantById(tenantId, ctx.session.branchId);
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    await clearTenantBlacklistState(ctx.session.branchId, tenantId);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to remove tenant from blacklist' });
  }
}

export async function removeBrokerFromBlacklist(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update blacklist records' });
    return;
  }

  const partnerAgencyId = String(req.params.partnerAgencyId ?? '').trim();
  if (!partnerAgencyId) {
    res.status(400).json({ error: 'Invalid partnerAgencyId' });
    return;
  }

  try {
    const partner = await getPartnerAgencyById(partnerAgencyId, ctx.session.branchId);
    if (!partner) {
      res.status(404).json({ error: 'Partner agency not found' });
      return;
    }
    await clearBrokerBlacklistState(ctx.session.branchId, partnerAgencyId);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to remove broker from blacklist' });
  }
}
