import { loadSessionPayload } from '../services/sessionService.js';
import {
  deactivateBlacklistById,
  getBlacklistById,
  insertBlacklistEntry,
  insertBlacklistRecord,
  listBlacklistByBranch,
  clearBrokerBlacklistState,
  clearTenantBlacklistState,
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
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    entityType: entityType === 'broker' ? 'broker' : 'tenant',
    tenantId: row.tenant_id != null ? String(row.tenant_id) : undefined,
    partnerAgencyId: row.partner_agency_id != null ? String(row.partner_agency_id) : undefined,
    name: String(row.name ?? '').trim() || '—',
    email: row.email ? String(row.email) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    governmentId: row.government_id ? String(row.government_id) : undefined,
    type: entityType === 'broker' ? 'Broker' : 'Tenant',
    reason: String(row.reason ?? ''),
    blacklistedBy: row.blacklisted_by != null ? String(row.blacklisted_by) : undefined,
    blacklistedByName:
      row.blacklisted_by_first_name || row.blacklisted_by_last_name
        ? `${String(row.blacklisted_by_first_name ?? '').trim()} ${String(row.blacklisted_by_last_name ?? '').trim()}`.trim()
        : undefined,
    date: row.created_at ? fmtDate(row.created_at) : '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function parseListFilters(req) {
  const typeRaw = String(req.query.type ?? 'all').trim().toLowerCase();
  const type = typeRaw === 'tenant' || typeRaw === 'broker' ? typeRaw : 'all';
  const search = String(req.query.search ?? '').trim();
  return { type, search };
}

function validateCreate(body) {
  const entityTypeRaw = String(body.entityType ?? '').trim().toLowerCase();
  if (entityTypeRaw !== 'tenant' && entityTypeRaw !== 'broker') return null;

  const reason = String(body.reason ?? '').trim();
  if (!reason) return null;

  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim() || null;
  const phone = String(body.phone ?? '').trim() || null;
  const governmentId = String(body.governmentId ?? body.government_id ?? '').trim() || null;

  const tenantIdRaw = body.tenantId;
  const partnerAgencyIdRaw = body.partnerAgencyId;

  const tenantId =
    tenantIdRaw === null || tenantIdRaw === undefined || String(tenantIdRaw).trim() === ''
      ? null
      : String(tenantIdRaw).trim();
  const partnerAgencyId =
    partnerAgencyIdRaw === null || partnerAgencyIdRaw === undefined || String(partnerAgencyIdRaw).trim() === ''
      ? null
      : String(partnerAgencyIdRaw).trim();

  if (entityTypeRaw === 'tenant' && partnerAgencyId) return null;
  if (entityTypeRaw === 'broker' && tenantId) return null;

  if (!name && !tenantId && !partnerAgencyId) return null;

  return {
    entityType: entityTypeRaw,
    name,
    email,
    phone,
    governmentId,
    tenantId,
    partnerAgencyId,
    reason,
  };
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
    const filters = parseListFilters(req);
    const rows = await listBlacklistByBranch(ctx.session.branchId, filters);
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
    if (parsed.entityType === 'broker' && parsed.partnerAgencyId) {
      const id = await tagBrokerPartnerAgencyBlacklist(
        ctx.session.branchId,
        parsed.partnerAgencyId,
        parsed.reason,
        ctx.session.user.id,
      );
      const created = await getBlacklistById(id, ctx.session.branchId);
      if (!created) {
        res.status(500).json({ error: 'Failed to load created blacklist record' });
        return;
      }
      res.status(201).json({ record: rowToBlacklist(created) });
      return;
    }

    if (parsed.entityType === 'tenant' && parsed.tenantId) {
      const id = await insertBlacklistRecord(ctx.session.branchId, {
        entityType: 'tenant',
        tenantId: parsed.tenantId,
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        governmentId: parsed.governmentId,
        reason: parsed.reason,
        taggedBy: ctx.session.user.id,
      });
      const created = await getBlacklistById(id, ctx.session.branchId);
      if (!created) {
        res.status(500).json({ error: 'Failed to load created blacklist record' });
        return;
      }
      res.status(201).json({ record: rowToBlacklist(created) });
      return;
    }

    const id = await insertBlacklistEntry(ctx.session.branchId, {
      entityType: parsed.entityType,
      name: parsed.name || '—',
      email: parsed.email,
      phone: parsed.phone,
      governmentId: parsed.governmentId,
      reason: parsed.reason,
      blacklistedBy: ctx.session.user.id,
      tenantId: parsed.tenantId,
      partnerAgencyId: parsed.partnerAgencyId,
    });

    const created = await getBlacklistById(id, ctx.session.branchId);
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

export async function removeBlacklistById(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update blacklist records' });
    return;
  }

  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  try {
    const ok = await deactivateBlacklistById(id, ctx.session.branchId);
    if (!ok) {
      res.status(404).json({ error: 'Blacklist record not found' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to remove blacklist record' });
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
