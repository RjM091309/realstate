import { loadSessionPayload } from '../services/sessionService.js';
import {
  deactivatePartnerAgencyById,
  getPartnerAgencyById,
  insertPartnerAgency,
  listPartnerAgenciesByBranch,
  updatePartnerAgencyById,
} from '../models/partnerAgenciesModel.js';
import { deactivateBlacklistForPartnerAgency, upsertActiveBrokerBlacklistRecord } from '../models/blacklistModel.js';

function rowToAgency(row) {
  return {
    id: String(row.id),
    name: String(row.agency_name),
    contactPerson: row.contact_person ? String(row.contact_person) : '',
    phone: row.contact_number ? String(row.contact_number) : '',
    email: row.email ? String(row.email) : undefined,
    kycVerified: Boolean(Number(row.kyc_verified)),
    isBlacklisted: Boolean(Number(row.is_blacklisted)),
    blacklistReason:
      row.blacklist_reason != null && String(row.blacklist_reason).trim() !== ''
        ? String(row.blacklist_reason)
        : undefined,
    active: Boolean(Number(row.active)),
  };
}

function parseOptionalBool(v) {
  if (v === true || v === false) return v;
  if (v === 1 || v === 0) return Boolean(v);
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return undefined;
}

function validateCreatePayload(body) {
  const agencyName = String(body.name ?? '').trim();
  if (!agencyName) return null;
  const contactPerson = String(body.contactPerson ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const emailRaw = body.email;
  const email =
    emailRaw === null || emailRaw === undefined || String(emailRaw).trim() === ''
      ? null
      : String(emailRaw).trim();
  const kycVerified = parseOptionalBool(body.kycVerified) ?? false;
  const isBlacklisted = Boolean(body.isBlacklisted);
  const blacklistReasonRaw = body.blacklistReason;
  const blacklistReason =
    blacklistReasonRaw === null || blacklistReasonRaw === undefined
      ? null
      : String(blacklistReasonRaw).trim() || null;

  return {
    agencyName,
    contactPerson: contactPerson || null,
    contactNumber: phone || null,
    email,
    kycVerified,
    isBlacklisted,
    blacklistReason,
  };
}

function validatePatchPayload(body) {
  const hasName = body.name !== undefined;
  const agencyName = hasName ? String(body.name ?? '').trim() : undefined;
  if (hasName && !agencyName) return null;

  const contactPerson =
    body.contactPerson === undefined ? undefined : String(body.contactPerson ?? '').trim() || null;
  const phone = body.phone === undefined ? undefined : String(body.phone ?? '').trim() || null;

  const email =
    body.email === undefined
      ? undefined
      : body.email === null || String(body.email).trim() === ''
        ? null
        : String(body.email).trim();

  const active = body.active === undefined ? undefined : parseOptionalBool(body.active);
  const kycVerified =
    body.kycVerified === undefined ? undefined : parseOptionalBool(body.kycVerified);
  const isBlacklisted = body.isBlacklisted === undefined ? undefined : parseOptionalBool(body.isBlacklisted);
  const blacklistReason =
    body.blacklistReason === undefined
      ? undefined
      : body.blacklistReason === null || String(body.blacklistReason).trim() === ''
        ? null
        : String(body.blacklistReason).trim();

  if (body.active !== undefined && active === undefined) return null;
  if (body.kycVerified !== undefined && kycVerified === undefined) return null;
  if (body.isBlacklisted !== undefined && isBlacklisted === undefined) return null;

  if (
    agencyName === undefined &&
    contactPerson === undefined &&
    phone === undefined &&
    email === undefined &&
    active === undefined &&
    kycVerified === undefined &&
    isBlacklisted === undefined &&
    blacklistReason === undefined
  ) {
    return null;
  }

  return {
    agencyName,
    contactPerson,
    contactNumber: phone,
    email,
    active,
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
  const parsed = validateCreatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid partner agency payload' });
    return;
  }
  if (parsed.isBlacklisted && !parsed.blacklistReason) {
    parsed.blacklistReason = 'Blacklisted';
  }
  try {
    const row = await insertPartnerAgency(ctx.session.branchId, parsed);
    if (!row) {
      res.status(500).json({ error: 'Failed to load created partner agency' });
      return;
    }
    if (parsed.isBlacklisted) {
      await upsertActiveBrokerBlacklistRecord(
        ctx.session.branchId,
        String(row.id),
        parsed.blacklistReason || 'Blacklisted',
        ctx.session.user.id,
      );
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
  const parsed = validatePatchPayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid partner agency payload' });
    return;
  }
  try {
    const existing = await getPartnerAgencyById(id, ctx.session.branchId);
    if (!existing) {
      res.status(404).json({ error: 'Partner agency not found' });
      return;
    }

    const next = {
      agencyName: parsed.agencyName ?? String(existing.agency_name),
      contactPerson: parsed.contactPerson ?? (existing.contact_person ? String(existing.contact_person) : null),
      contactNumber: parsed.contactNumber ?? (existing.contact_number ? String(existing.contact_number) : null),
      email: parsed.email ?? (existing.email ? String(existing.email) : null),
      active: parsed.active ?? Boolean(Number(existing.active)),
      kycVerified: parsed.kycVerified ?? Boolean(Number(existing.kyc_verified)),
      isBlacklisted: parsed.isBlacklisted ?? Boolean(Number(existing.is_blacklisted)),
      blacklistReason:
        parsed.blacklistReason !== undefined
          ? parsed.blacklistReason
          : existing.blacklist_reason != null && String(existing.blacklist_reason).trim() !== ''
            ? String(existing.blacklist_reason)
            : null,
    };
    if (!next.isBlacklisted) {
      next.blacklistReason = null;
    }

    if (next.kycVerified) {
      if (!next.contactPerson || !next.contactNumber) {
        res.status(400).json({
          error: 'To verify an agency, contactPerson and phone are required',
        });
        return;
      }
    }

    const affected = await updatePartnerAgencyById(id, ctx.session.branchId, next);
    if (affected === 0) {
      res.status(404).json({ error: 'Partner agency not found' });
      return;
    }

    if (next.isBlacklisted) {
      await upsertActiveBrokerBlacklistRecord(
        ctx.session.branchId,
        id,
        next.blacklistReason || 'Blacklisted',
        ctx.session.user.id,
      );
    } else {
      await deactivateBlacklistForPartnerAgency(ctx.session.branchId, id);
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
