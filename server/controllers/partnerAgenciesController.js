import { loadSessionPayload } from '../services/sessionService.js';
import {
  deactivatePartnerAgencyById,
  getPartnerAgencyById,
  insertPartnerAgency,
  listPartnerAgenciesByBranch,
  updatePartnerAgencyById,
  updatePartnerAgencyDocumentPathById,
} from '../models/partnerAgenciesModel.js';
import { deactivateBlacklistForPartnerAgency, upsertActiveBrokerBlacklistRecord } from '../models/blacklistModel.js';
import { finalizeKycUploadToWebpOrPdf } from '../services/kycUploadService.js';

function rowToAgency(row) {
  return {
    id: String(row.id),
    name: String(row.agency_name),
    contactPerson: row.contact_person ? String(row.contact_person) : '',
    phone: row.contact_number ? String(row.contact_number) : '',
    email: row.email ? String(row.email) : undefined,
    nationality: row.nationality != null && String(row.nationality).trim() !== '' ? String(row.nationality) : undefined,
    documentType: row.document_type != null && String(row.document_type).trim() !== '' ? String(row.document_type) : undefined,
    documentNo: row.document_no != null && String(row.document_no).trim() !== '' ? String(row.document_no) : undefined,
    expiryDate: row.expiry_date
      ? typeof row.expiry_date === 'string'
        ? row.expiry_date.slice(0, 10)
        : `${row.expiry_date.getFullYear()}-${String(row.expiry_date.getMonth() + 1).padStart(2, '0')}-${String(row.expiry_date.getDate()).padStart(2, '0')}`
      : undefined,
    filePath: row.file_path != null && String(row.file_path).trim() !== '' ? String(row.file_path) : undefined,
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
  const nationalityRaw = body.nationality;
  const nationality =
    nationalityRaw === null || nationalityRaw === undefined || String(nationalityRaw).trim() === ''
      ? null
      : String(nationalityRaw).trim().slice(0, 3).toUpperCase();
  const documentTypeRaw = body.documentType;
  const documentType =
    documentTypeRaw === null || documentTypeRaw === undefined || String(documentTypeRaw).trim() === ''
      ? null
      : String(documentTypeRaw).trim();
  const documentNoRaw = body.documentNo;
  const documentNo =
    documentNoRaw === null || documentNoRaw === undefined || String(documentNoRaw).trim() === ''
      ? null
      : String(documentNoRaw).trim();
  const expiryRaw = body.expiryDate;
  let expiryDate = null;
  if (expiryRaw !== null && expiryRaw !== undefined && String(expiryRaw).trim() !== '') {
    const value = String(expiryRaw).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    expiryDate = value;
  }
  const filePathRaw = body.filePath;
  const filePath =
    filePathRaw === null || filePathRaw === undefined || String(filePathRaw).trim() === ''
      ? null
      : String(filePathRaw).trim();
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
    nationality,
    documentType,
    documentNo,
    expiryDate,
    filePath,
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

  const nationality =
    body.nationality === undefined
      ? undefined
      : body.nationality === null || String(body.nationality).trim() === ''
        ? null
        : String(body.nationality).trim().slice(0, 3).toUpperCase();

  const documentType =
    body.documentType === undefined
      ? undefined
      : body.documentType === null || String(body.documentType).trim() === ''
        ? null
        : String(body.documentType).trim();

  const documentNo =
    body.documentNo === undefined
      ? undefined
      : body.documentNo === null || String(body.documentNo).trim() === ''
        ? null
        : String(body.documentNo).trim();

  let expiryDate = undefined;
  if (body.expiryDate !== undefined) {
    if (body.expiryDate === null || String(body.expiryDate).trim() === '') {
      expiryDate = null;
    } else {
      const value = String(body.expiryDate).trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      expiryDate = value;
    }
  }

  const filePath =
    body.filePath === undefined
      ? undefined
      : body.filePath === null || String(body.filePath).trim() === ''
        ? null
        : String(body.filePath).trim();

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
    nationality === undefined &&
    documentType === undefined &&
    documentNo === undefined &&
    expiryDate === undefined &&
    filePath === undefined &&
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
    nationality,
    documentType,
    documentNo,
    expiryDate,
    filePath,
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
      nationality:
        parsed.nationality !== undefined
          ? parsed.nationality
          : existing.nationality != null && String(existing.nationality).trim() !== ''
            ? String(existing.nationality)
            : null,
      documentType:
        parsed.documentType !== undefined
          ? parsed.documentType
          : existing.document_type != null && String(existing.document_type).trim() !== ''
            ? String(existing.document_type)
            : null,
      documentNo:
        parsed.documentNo !== undefined
          ? parsed.documentNo
          : existing.document_no != null && String(existing.document_no).trim() !== ''
            ? String(existing.document_no)
            : null,
      expiryDate:
        parsed.expiryDate !== undefined
          ? parsed.expiryDate
          : existing.expiry_date
            ? typeof existing.expiry_date === 'string'
              ? existing.expiry_date.slice(0, 10)
              : `${existing.expiry_date.getFullYear()}-${String(existing.expiry_date.getMonth() + 1).padStart(2, '0')}-${String(existing.expiry_date.getDate()).padStart(2, '0')}`
            : null,
      filePath:
        parsed.filePath !== undefined
          ? parsed.filePath
          : existing.file_path != null && String(existing.file_path).trim() !== ''
            ? String(existing.file_path)
            : null,
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

export async function uploadPartnerAgencyKycDocument(req, res) {
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

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  let publicUrl;
  try {
    ({ publicUrl } = await finalizeKycUploadToWebpOrPdf(file));
  } catch (e) {
    const code = typeof e?.statusCode === 'number' ? e.statusCode : 500;
    const msg = e instanceof Error ? e.message : 'Failed to process upload';
    if (code >= 400 && code < 500) {
      res.status(code).json({ error: msg });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to upload document' });
    return;
  }

  try {
    const existing = await getPartnerAgencyById(id, ctx.session.branchId);
    if (!existing) {
      res.status(404).json({ error: 'Partner agency not found' });
      return;
    }
    await updatePartnerAgencyDocumentPathById(id, ctx.session.branchId, publicUrl);
    const row = await getPartnerAgencyById(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Partner agency not found' });
      return;
    }
    res.json({ agency: rowToAgency(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to upload document' });
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
