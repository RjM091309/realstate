import { loadSessionPayload } from '../services/sessionService.js';
import {
  deleteTenantById,
  getTenantById,
  insertTenant,
  listTenantsByBranch,
  updateTenantById,
} from '../models/tenantsModel.js';

function fmtDate(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rowToTenant(row) {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone),
    idType: String(row.id_type),
    idNumber: String(row.id_number),
    idExpiry: row.id_expiry ? fmtDate(row.id_expiry) : '',
    idImageUrl: row.id_image_url ? String(row.id_image_url) : undefined,
    kycVerified: Boolean(Number(row.kyc_verified)),
    isBlacklisted: Boolean(Number(row.is_blacklisted)),
    blacklistReason: row.blacklist_reason ? String(row.blacklist_reason) : undefined,
  };
}

function validatePayload(body) {
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const idType = String(body.idType ?? '').trim();
  const idNumber = String(body.idNumber ?? '').trim();
  if (!name || !email || !phone || !idType || !idNumber) return null;

  const idExpiryRaw = body.idExpiry;
  let idExpiry = null;
  if (idExpiryRaw !== null && idExpiryRaw !== undefined && String(idExpiryRaw).trim() !== '') {
    const value = String(idExpiryRaw).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    idExpiry = value;
  }

  const idImageUrlRaw = body.idImageUrl;
  const idImageUrl =
    idImageUrlRaw === null || idImageUrlRaw === undefined || String(idImageUrlRaw).trim() === ''
      ? null
      : String(idImageUrlRaw).trim();

  const kycVerified = body.kycVerified === undefined ? true : Boolean(body.kycVerified);
  const isBlacklisted = Boolean(body.isBlacklisted);
  const blacklistReasonRaw = body.blacklistReason;
  const blacklistReason =
    blacklistReasonRaw === null || blacklistReasonRaw === undefined
      ? null
      : String(blacklistReasonRaw).trim() || null;

  return {
    name,
    email,
    phone,
    idType,
    idNumber,
    idExpiry,
    idImageUrl,
    kycVerified,
    isBlacklisted,
    blacklistReason,
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

export async function listTenants(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const rows = await listTenantsByBranch(ctx.session.branchId);
    res.json({ tenants: rows.map(rowToTenant) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load tenants' });
  }
}

export async function createTenant(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to create tenants' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid tenant payload' });
    return;
  }
  try {
    const row = await insertTenant(ctx.session.branchId, parsed);
    if (!row) {
      res.status(500).json({ error: 'Failed to load created tenant' });
      return;
    }
    res.status(201).json({ tenant: rowToTenant(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
}

export async function updateTenant(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update tenants' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid tenant payload' });
    return;
  }
  try {
    const affectedRows = await updateTenantById(id, ctx.session.branchId, parsed);
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    const row = await getTenantById(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    res.json({ tenant: rowToTenant(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
}

export async function deleteTenant(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete tenants' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const affectedRows = await deleteTenantById(id, ctx.session.branchId);
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
}
