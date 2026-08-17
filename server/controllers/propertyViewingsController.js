import { loadSessionPayload } from '../services/sessionService.js';
import { getUnitById } from '../models/unitsModel.js';
import { logAudit } from '../services/auditLogService.js';
import {
  deleteViewingById,
  getViewingById,
  insertViewing,
  listViewingsByBranch,
  updateViewingById,
} from '../models/propertyViewingsModel.js';

const STATUSES = new Set(['scheduled', 'completed', 'cancelled', 'no_show']);

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

function mapViewingRow(r) {
  const tower = r.unit_tower ? `${r.unit_tower} · ` : '';
  const unitLabel = `${tower}${r.unit_number ?? ''}`.trim() || '—';
  const agentName = [r.agent_first_name, r.agent_last_name].filter(Boolean).join(' ').trim();
  return {
    id: String(r.id),
    unitId: String(r.unit_id),
    unitLabel,
    buildingName: String(r.building_name ?? ''),
    prospectName: String(r.prospect_name),
    prospectContact: r.prospect_contact ? String(r.prospect_contact) : null,
    scheduledAt: fmtDateTime(r.scheduled_at),
    status: String(r.status),
    agentId: r.agent_id != null ? String(r.agent_id) : null,
    agentName: agentName || null,
    notes: r.notes ? String(r.notes) : null,
    createdAt: r.created_at ? fmtDateTime(r.created_at) : '',
    updatedAt: r.updated_at ? fmtDateTime(r.updated_at) : '',
  };
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
  return { session, userId };
}

function canCrud(session, op) {
  // Property viewings are scheduled from the Calendar — reuse the calendar CRUD permission.
  const permissions = session.crud?.calendar;
  if (!permissions) return false;
  if (op === 'create') return Boolean(permissions.create);
  if (op === 'update') return Boolean(permissions.update);
  return Boolean(permissions.delete);
}

function validateCreatePayload(body) {
  const unitId = String(body?.unitId ?? '').trim();
  const prospectName = String(body?.prospectName ?? '').trim();
  const scheduledAt = String(body?.scheduledAt ?? '').trim();
  if (!unitId || !prospectName || !scheduledAt) return null;
  if (prospectName.length > 180) return null;
  if (!/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(scheduledAt)) return null;

  const contactRaw = body?.prospectContact;
  const prospectContact =
    contactRaw === null || contactRaw === undefined || String(contactRaw).trim() === ''
      ? null
      : String(contactRaw).trim().slice(0, 120);

  const agentIdRaw = body?.agentId;
  const agentId =
    agentIdRaw === null || agentIdRaw === undefined || String(agentIdRaw).trim() === ''
      ? null
      : String(agentIdRaw).trim();

  const notesRaw = body?.notes;
  const notes =
    notesRaw === null || notesRaw === undefined || String(notesRaw).trim() === ''
      ? null
      : String(notesRaw).trim();

  return {
    unitId,
    prospectName,
    prospectContact,
    scheduledAt: scheduledAt.replace('T', ' ').slice(0, 19),
    agentId,
    notes,
  };
}

export async function listBranchViewings(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const rows = await listViewingsByBranch(ctx.session.branchId);
    res.json({ viewings: rows.map(mapViewingRow) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load property viewings' });
  }
}

export async function createViewing(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to schedule property viewings' });
    return;
  }
  const parsed = validateCreatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid viewing payload' });
    return;
  }
  try {
    const unit = await getUnitById(parsed.unitId, ctx.session.branchId);
    if (!unit) {
      res.status(400).json({ error: 'Invalid unit' });
      return;
    }
    const row = await insertViewing(ctx.session.branchId, { ...parsed, createdBy: ctx.userId });
    if (!row) {
      res.status(500).json({ error: 'Failed to schedule viewing' });
      return;
    }
    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.userId,
      moduleName: 'calendar',
      recordTable: 'property_viewing',
      recordId: row.id,
      action: 'create',
      changeSummary: `Scheduled property viewing for ${parsed.prospectName}`,
    });
    res.status(201).json({ viewing: mapViewingRow(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to schedule viewing' });
  }
}

export async function updateViewing(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update property viewings' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  const existing = await getViewingById(id, ctx.session.branchId);
  if (!existing) {
    res.status(404).json({ error: 'Viewing not found' });
    return;
  }

  const payload = {};
  if (req.body?.status !== undefined) {
    const status = String(req.body.status).trim();
    if (!STATUSES.has(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    payload.status = status;
  }
  if (req.body?.scheduledAt !== undefined) {
    const raw = String(req.body.scheduledAt).trim();
    if (!/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(raw)) {
      res.status(400).json({ error: 'Invalid scheduled date/time' });
      return;
    }
    payload.scheduledAt = raw.replace('T', ' ').slice(0, 19);
  }
  if (req.body?.prospectName !== undefined) {
    const name = String(req.body.prospectName).trim();
    if (!name || name.length > 180) {
      res.status(400).json({ error: 'Invalid prospect name' });
      return;
    }
    payload.prospectName = name;
  }
  if (req.body?.prospectContact !== undefined) {
    const raw = req.body.prospectContact;
    payload.prospectContact = raw === null || String(raw).trim() === '' ? null : String(raw).trim().slice(0, 120);
  }
  if (req.body?.agentId !== undefined) {
    const raw = req.body.agentId;
    payload.agentId = raw === null || String(raw).trim() === '' ? null : String(raw).trim();
  }
  if (req.body?.notes !== undefined) {
    const raw = req.body.notes;
    payload.notes = raw === null || String(raw).trim() === '' ? null : String(raw).trim();
  }
  if (req.body?.unitId !== undefined) {
    const unitId = String(req.body.unitId).trim();
    if (!unitId) {
      res.status(400).json({ error: 'Invalid unit' });
      return;
    }
    const unit = await getUnitById(unitId, ctx.session.branchId);
    if (!unit) {
      res.status(400).json({ error: 'Invalid unit' });
      return;
    }
    payload.unitId = unitId;
  }

  if (Object.keys(payload).length === 0) {
    res.status(400).json({ error: 'Invalid request payload' });
    return;
  }

  try {
    const affected = await updateViewingById(id, ctx.session.branchId, payload);
    if (affected === 0) {
      res.status(404).json({ error: 'Viewing not found' });
      return;
    }
    const row = await getViewingById(id, ctx.session.branchId);
    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.userId,
      moduleName: 'calendar',
      recordTable: 'property_viewing',
      recordId: id,
      action: 'update',
      changeSummary: `Updated property viewing #${id}`,
    });
    res.json({ viewing: row ? mapViewingRow(row) : null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update viewing' });
  }
}

export async function deleteViewing(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete property viewings' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const affected = await deleteViewingById(id, ctx.session.branchId);
    if (affected === 0) {
      res.status(404).json({ error: 'Viewing not found' });
      return;
    }
    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.userId,
      moduleName: 'calendar',
      recordTable: 'property_viewing',
      recordId: id,
      action: 'delete',
      changeSummary: `Deleted property viewing #${id}`,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete viewing' });
  }
}
