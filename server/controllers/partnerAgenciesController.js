import { loadSessionPayload } from '../services/sessionService.js';
import {
  deactivatePartnerAgencyById,
  getPartnerAgencyById,
  insertPartnerAgency,
  listPartnerAgenciesByBranch,
  updatePartnerAgencyById,
} from '../models/partnerAgenciesModel.js';

function rowToAgency(row) {
  return {
    id: String(row.id),
    name: String(row.agency_name),
    contactPerson: row.contact_person ? String(row.contact_person) : '',
    phone: row.contact_number ? String(row.contact_number) : '',
    email: row.email ? String(row.email) : undefined,
  };
}

function validatePayload(body) {
  const agencyName = String(body.name ?? '').trim();
  if (!agencyName) return null;
  const contactPerson = String(body.contactPerson ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const emailRaw = body.email;
  const email =
    emailRaw === null || emailRaw === undefined || String(emailRaw).trim() === ''
      ? null
      : String(emailRaw).trim();

  return { agencyName, contactPerson: contactPerson || null, contactNumber: phone || null, email };
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

export async function listPartnerAgencies(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const rows = await listPartnerAgenciesByBranch(ctx.session.branchId);
    res.json({ agencies: rows.map(rowToAgency) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load partner agencies' });
  }
}

export async function createPartnerAgency(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to create partner agencies' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid partner agency payload' });
    return;
  }
  try {
    const row = await insertPartnerAgency(ctx.session.branchId, parsed);
    if (!row) {
      res.status(500).json({ error: 'Failed to load created partner agency' });
      return;
    }
    res.status(201).json({ agency: rowToAgency(row) });
  } catch (e) {
    const code = e?.code;
    if (code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Partner agency name already exists for this branch' });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to create partner agency' });
  }
}

export async function updatePartnerAgency(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update partner agencies' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid partner agency payload' });
    return;
  }
  try {
    const affected = await updatePartnerAgencyById(id, ctx.session.branchId, parsed);
    if (affected === 0) {
      res.status(404).json({ error: 'Partner agency not found' });
      return;
    }
    const row = await getPartnerAgencyById(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Partner agency not found' });
      return;
    }
    res.json({ agency: rowToAgency(row) });
  } catch (e) {
    const code = e?.code;
    if (code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Partner agency name already exists for this branch' });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to update partner agency' });
  }
}

export async function deletePartnerAgency(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete partner agencies' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const affected = await deactivatePartnerAgencyById(id, ctx.session.branchId);
    if (affected === 0) {
      res.status(404).json({ error: 'Partner agency not found' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete partner agency' });
  }
}
