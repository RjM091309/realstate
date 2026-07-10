import { loadSessionPayload } from '../services/sessionService.js';
import { logAudit } from '../services/auditLogService.js';
import {
  deactivateLandlordById,
  getLandlordById,
  insertLandlord,
  listLandlordsByBranch,
  updateLandlordById,
} from '../models/landlordsModel.js';

function fmtDate(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDateTime(d) {
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

function rowToLandlord(row) {
  return {
    id: String(row.id),
    fullName: String(row.full_name ?? ''),
    mobileNo: row.mobile_no ? String(row.mobile_no) : '',
    email: row.email ? String(row.email) : '',
    govIdNo: row.gov_id_no ? String(row.gov_id_no) : '',
    active: Boolean(Number(row.active)),
    createdAt: row.created_at != null ? fmtDateTime(row.created_at) : '',
  };
}

function validatePayload(body) {
  const fullName = String(body?.fullName ?? body?.full_name ?? '').trim();
  if (!fullName) return null;
  if (fullName.length > 180) return null;
  const mobileNoRaw = body?.mobileNo ?? body?.mobile_no ?? null;
  const emailRaw = body?.email ?? null;
  const govIdNoRaw = body?.govIdNo ?? body?.gov_id_no ?? null;

  const mobileNo =
    mobileNoRaw === null || mobileNoRaw === undefined || String(mobileNoRaw).trim() === ''
      ? null
      : String(mobileNoRaw).trim().slice(0, 40);
  const email =
    emailRaw === null || emailRaw === undefined || String(emailRaw).trim() === ''
      ? null
      : String(emailRaw).trim().slice(0, 180);
  const govIdNo =
    govIdNoRaw === null || govIdNoRaw === undefined || String(govIdNoRaw).trim() === ''
      ? null
      : String(govIdNoRaw).trim().slice(0, 100);

  return { fullName, mobileNo, email, govIdNo };
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

export async function listLandlords(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const rows = await listLandlordsByBranch(ctx.session.branchId);
    res.json({ landlords: rows.map(rowToLandlord) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load landlords' });
  }
}

export async function getLandlord(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const row = await getLandlordById(id, ctx.session.branchId);
    if (!row || !Number(row.active)) {
      res.status(404).json({ error: 'Landlord not found' });
      return;
    }
    res.json({ landlord: rowToLandlord(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load landlord' });
  }
}

export async function createLandlord(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to create landlords' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid landlord payload' });
    return;
  }
  try {
    const id = await insertLandlord(ctx.session.branchId, parsed);
    const row = await getLandlordById(id, ctx.session.branchId);
    if (!row) {
      res.status(500).json({ error: 'Failed to load created landlord' });
      return;
    }
    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'crm',
      recordTable: 'landlord_profile',
      recordId: id,
      action: 'create',
      changeSummary: `Created landlord: ${parsed.fullName}`,
    });
    res.status(201).json({ landlord: rowToLandlord(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create landlord' });
  }
}

export async function updateLandlord(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update landlords' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid landlord payload' });
    return;
  }
  try {
    const affected = await updateLandlordById(id, ctx.session.branchId, parsed);
    if (affected === 0) {
      res.status(404).json({ error: 'Landlord not found' });
      return;
    }
    const row = await getLandlordById(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Landlord not found' });
      return;
    }
    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'crm',
      recordTable: 'landlord_profile',
      recordId: Number(id),
      action: 'update',
      changeSummary: `Updated landlord: ${parsed.fullName}`,
    });
    res.json({ landlord: rowToLandlord(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update landlord' });
  }
}

export async function deleteLandlord(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete landlords' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const affected = await deactivateLandlordById(id, ctx.session.branchId);
    if (affected === 0) {
      res.status(404).json({ error: 'Landlord not found' });
      return;
    }
    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'crm',
      recordTable: 'landlord_profile',
      recordId: Number(id),
      action: 'delete',
      changeSummary: `Deactivated landlord id=${id}`,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    if (e?.errno === 1451 || e?.code === 'ER_ROW_IS_REFERENCED_2') {
      res.status(409).json({ error: 'This landlord is still linked to a contract.' });
      return;
    }
    res.status(500).json({ error: 'Failed to delete landlord' });
  }
}

