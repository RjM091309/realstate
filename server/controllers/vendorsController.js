import { loadSessionPayload } from '../services/sessionService.js';
import {
  getVendorById,
  insertVendor,
  listVendorsByBranch,
  softDeleteVendor,
  updateVendor,
} from '../models/vendorsModel.js';
import { logAudit } from '../services/auditLogService.js';

const VALID_CATEGORIES = new Set([
  'plumbing',
  'electrical',
  'hvac',
  'carpentry',
  'painting',
  'pest_control',
  'cleaning',
  'appliance',
  'general',
  'other',
]);

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

function canCrud(session, op) {
  const permissions = session.crud?.maintenance;
  if (!permissions) return false;
  if (op === 'create') return Boolean(permissions.create);
  if (op === 'update') return Boolean(permissions.update);
  return Boolean(permissions.delete);
}

function validatePayload(body) {
  const name = String(body?.name ?? '').trim();
  if (!name || name.length > 180) return null;
  const categoryRaw = String(body?.category ?? 'general').trim();
  const category = VALID_CATEGORIES.has(categoryRaw) ? categoryRaw : 'general';
  const contactPerson = body?.contactPerson ? String(body.contactPerson).trim() || null : null;
  const phone = body?.phone ? String(body.phone).trim() || null : null;
  const email = body?.email ? String(body.email).trim() || null : null;
  const address = body?.address ? String(body.address).trim() || null : null;
  const notes = body?.notes ? String(body.notes).trim() || null : null;
  return { name, category, contactPerson, phone, email, address, notes };
}

function mapVendorRow(r) {
  return {
    id: String(r.id),
    name: String(r.name),
    category: String(r.category),
    contactPerson: r.contact_person ? String(r.contact_person) : undefined,
    phone: r.phone ? String(r.phone) : undefined,
    email: r.email ? String(r.email) : undefined,
    address: r.address ? String(r.address) : undefined,
    notes: r.notes ? String(r.notes) : undefined,
    createdAt: r.created_at ? fmtDate(r.created_at) : '',
    updatedAt: r.updated_at ? fmtDate(r.updated_at) : '',
  };
}

export async function listVendors(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const rows = await listVendorsByBranch(ctx.session.branchId);
    res.json({ vendors: rows.map(mapVendorRow) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load vendors' });
  }
}

export async function createVendor(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'You do not have permission to add vendors' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid vendor payload' });
    return;
  }
  try {
    const id = await insertVendor(ctx.session.branchId, parsed);
    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'maintenance',
      recordTable: 'vendor',
      recordId: id,
      action: 'create',
      changeSummary: `Added vendor: ${parsed.name}`,
    });
    const row = await getVendorById(id, ctx.session.branchId);
    res.status(201).json({ vendor: mapVendorRow(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
}

export async function updateVendorHandler(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'You do not have permission to update vendors' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  const parsed = validatePayload(req.body ?? {});
  if (!id || !parsed) {
    res.status(400).json({ error: 'Invalid vendor payload' });
    return;
  }
  try {
    const existing = await getVendorById(id, ctx.session.branchId);
    if (!existing) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }
    await updateVendor(id, ctx.session.branchId, parsed);
    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'maintenance',
      recordTable: 'vendor',
      recordId: id,
      action: 'update',
      changeSummary: `Updated vendor: ${parsed.name}`,
    });
    const row = await getVendorById(id, ctx.session.branchId);
    res.json({ vendor: mapVendorRow(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
}

export async function deleteVendorHandler(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'delete')) {
    res.status(403).json({ error: 'You do not have permission to delete vendors' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid vendor id' });
    return;
  }
  try {
    const existing = await getVendorById(id, ctx.session.branchId);
    if (!existing) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }
    await softDeleteVendor(id, ctx.session.branchId);
    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'maintenance',
      recordTable: 'vendor',
      recordId: id,
      action: 'delete',
      changeSummary: `Removed vendor: ${existing.name}`,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
}
