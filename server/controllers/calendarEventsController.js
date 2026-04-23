import { loadSessionPayload } from '../services/sessionService.js';
import { getContractById } from '../models/contractsModel.js';
import { getPaymentById } from '../models/paymentsModel.js';
import {
  deleteCalendarEventById,
  getCalendarEventById,
  insertCalendarEvent,
  listCalendarEventsByBranch,
  updateCalendarEventById,
} from '../models/calendarEventsModel.js';

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

function rowToCalendarEvent(row) {
  let metadata;
  if (row.metadata_json != null && row.metadata_json !== '') {
    try {
      const raw = row.metadata_json;
      if (typeof raw === 'string') {
        metadata = JSON.parse(raw);
      } else if (typeof raw === 'object') {
        metadata = raw;
      }
    } catch {
      metadata = undefined;
    }
  }
  return {
    id: String(row.id),
    contractId: row.contract_id != null ? String(row.contract_id) : null,
    paymentScheduleId: row.payment_schedule_id != null ? String(row.payment_schedule_id) : null,
    eventType: String(row.event_type),
    eventDate: fmtDate(row.event_date),
    title: String(row.title),
    colorCode: row.color_code != null ? String(row.color_code) : null,
    metadata,
    createdAt: row.created_at ? fmtDateTime(row.created_at) : '',
  };
}

const EVENT_TYPES = new Set([
  'move_in',
  'move_out',
  'payment_due',
  'payment_received',
  'inspection',
  'other',
]);

function validatePayload(body) {
  const eventType = String(body.eventType ?? '').trim();
  const eventDate = String(body.eventDate ?? '').trim().slice(0, 10);
  const title = String(body.title ?? '').trim();
  if (!EVENT_TYPES.has(eventType) || !eventDate || !title) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return null;

  const contractIdRaw = body.contractId;
  const contractId =
    contractIdRaw === null || contractIdRaw === undefined || String(contractIdRaw).trim() === ''
      ? null
      : String(contractIdRaw).trim();

  const psRaw = body.paymentScheduleId;
  const paymentScheduleId =
    psRaw === null || psRaw === undefined || String(psRaw).trim() === ''
      ? null
      : String(psRaw).trim();

  const colorRaw = body.colorCode;
  const colorCode =
    colorRaw === null || colorRaw === undefined || String(colorRaw).trim() === ''
      ? null
      : String(colorRaw).trim().slice(0, 20);

  let metadataJson = null;
  const metadataRaw = body.metadata;
  if (metadataRaw !== null && metadataRaw !== undefined) {
    try {
      metadataJson = JSON.stringify(metadataRaw);
    } catch {
      return null;
    }
  }

  return { contractId, paymentScheduleId, eventType, eventDate, title, colorCode, metadataJson };
}

async function validateCalendarForeignKeys(branchId, parsed) {
  if (parsed.contractId) {
    const c = await getContractById(parsed.contractId, branchId);
    if (!c) return { ok: false, error: 'Invalid contract' };
  }
  if (parsed.paymentScheduleId) {
    const ps = await getPaymentById(parsed.paymentScheduleId, branchId);
    if (!ps) return { ok: false, error: 'Invalid payment schedule' };
    if (parsed.contractId && String(ps.contract_id) !== String(parsed.contractId)) {
      return { ok: false, error: 'Payment schedule does not match contract' };
    }
  }
  return { ok: true };
}

function canCrud(session, op) {
  const permissions = session.crud?.calendar;
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

export async function listCalendarEvents(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const rows = await listCalendarEventsByBranch(ctx.session.branchId);
    res.json({ events: rows.map(rowToCalendarEvent) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load calendar events' });
  }
}

export async function createCalendarEvent(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to create calendar events' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid event payload' });
    return;
  }
  const fk = await validateCalendarForeignKeys(ctx.session.branchId, parsed);
  if (!fk.ok) {
    res.status(400).json({ error: fk.error });
    return;
  }
  try {
    const row = await insertCalendarEvent(ctx.session.branchId, parsed);
    if (!row) {
      res.status(500).json({ error: 'Failed to create calendar event' });
      return;
    }
    res.status(201).json({ event: rowToCalendarEvent(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
}

export async function updateCalendarEvent(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update calendar events' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid event payload' });
    return;
  }
  const fk = await validateCalendarForeignKeys(ctx.session.branchId, parsed);
  if (!fk.ok) {
    res.status(400).json({ error: fk.error });
    return;
  }
  try {
    const affected = await updateCalendarEventById(id, ctx.session.branchId, parsed);
    if (affected === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    const row = await getCalendarEventById(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json({ event: rowToCalendarEvent(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
}

export async function deleteCalendarEvent(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete calendar events' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const affected = await deleteCalendarEventById(id, ctx.session.branchId);
    if (affected === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
}

