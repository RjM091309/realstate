import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadSessionPayload } from '../services/sessionService.js';
import {
  deleteTenantById,
  getTenantById,
  insertKycUploadRevision,
  insertTenant,
  listTenantsByBranch,
  listRepositoryDocumentsForPortal,
  listTenantAttachmentDocumentsForPortal,
  getPrimaryContractIdForTenant,
  getLatestLeaseContractRepositoryDocForTenant,
  updateTenantById,
} from '../models/tenantsModel.js';
import { deactivateBlacklistForTenant, upsertActiveTenantBlacklist } from '../models/blacklistModel.js';
import { finalizeKycUploadToWebpOrPdf } from '../services/kycUploadService.js';
import { isValidPortalArtifactSlug, streamPortalArtifactPdf } from '../services/portalArtifactPdfService.js';
import { finalizeRepositoryUploadToWebpOrPdf } from '../services/repositoryUploadService.js';
import { insertRepositoryDocument } from '../models/documentsModel.js';
import { logAudit } from '../services/auditLogService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.normalize(path.join(__dirname, '..', 'uploads'));

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileNameFromPath(filePathRaw, titleFallback) {
  const s = String(filePathRaw ?? '');
  try {
    if (s.startsWith('http://') || s.startsWith('https://')) {
      const u = new URL(s);
      const base = path.basename(u.pathname);
      if (base && base !== '/' && base !== '.') return base;
    }
  } catch {
    // ignore
  }
  const base = path.basename(s.split('?')[0]);
  if (base && base !== '/' && base !== '.') return base;
  const t = String(titleFallback ?? 'document').replace(/[^\w.\-]+/g, '_');
  return t.includes('.') ? t : `${t}.pdf`;
}

function normalizeClientDownloadPath(filePathRaw) {
  const s = String(filePathRaw ?? '').trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return s.startsWith('/') ? s : `/${s}`;
}

function resolveUploadDiskPath(filePathRaw) {
  let s = String(filePathRaw ?? '').trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      s = new URL(s).pathname;
    } catch {
      return null;
    }
  }
  if (!s.startsWith('/')) s = `/${s}`;
  if (!s.startsWith('/uploads/')) return null;
  const rel = s.replace(/^\/uploads\//, '');
  const full = path.normalize(path.join(UPLOADS_ROOT, rel));
  if (!full.startsWith(UPLOADS_ROOT)) return null;
  return full;
}

async function statUploadFileSize(filePathRaw) {
  const diskPath = resolveUploadDiskPath(filePathRaw);
  if (!diskPath) return null;
  try {
    const st = await fs.stat(diskPath);
    if (!st.isFile()) return null;
    return st.size;
  } catch {
    return null;
  }
}

function attachmentTitle(docType) {
  if (docType === 'contract_attachment') return 'Contract attachment';
  return 'Supporting document';
}

function logTenantAudit(ctx, tenantId, action, changeSummary) {
  void logAudit({
    branchId: ctx.session.branchId,
    actorUserId: ctx.session.user.id,
    moduleName: 'crm',
    recordTable: 'tenant_profile',
    recordId: tenantId,
    action,
    changeSummary,
  });
}

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

function rowToTenant(row) {
  const idType = row.id_type != null && String(row.id_type).trim() !== '' ? String(row.id_type) : '';
  const idNumber =
    row.id_number != null && String(row.id_number).trim() !== '' ? String(row.id_number) : '';
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone),
    nationality: row.nationality != null && String(row.nationality).trim() !== '' ? String(row.nationality) : undefined,
    birthDate: row.birth_date ? fmtDate(row.birth_date) : '',
    idType,
    idNumber,
    idExpiry: row.id_expiry ? fmtDate(row.id_expiry) : '',
    idImageUrl: row.id_image_url ? String(row.id_image_url) : undefined,
    kycVerified: Boolean(Number(row.kyc_verified)),
    isBlacklisted: Boolean(Number(row.is_blacklisted)),
    blacklistReason: row.blacklist_reason ? String(row.blacklist_reason) : undefined,
    createdAt: row.created_at != null ? fmtDateTime(row.created_at) : '',
  };
}

function validatePayload(body) {
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const idType = String(body.idType ?? '').trim();
  const idNumber = String(body.idNumber ?? '').trim();
  if (!name || !email || !phone) return null;

  const nationalityRaw = body.nationality;
  const nationality =
    nationalityRaw === null || nationalityRaw === undefined ? null : String(nationalityRaw).trim() || null;

  const birthDateRaw = body.birthDate;
  let birthDate = null;
  if (birthDateRaw !== null && birthDateRaw !== undefined && String(birthDateRaw).trim() !== '') {
    const value = String(birthDateRaw).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    birthDate = value;
  }

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
    nationality,
    birthDate,
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

export async function getTenant(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const row = await getTenantById(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    res.json({ tenant: rowToTenant(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load tenant' });
  }
}

export async function listTenantPortalDocuments(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const tenantRow = await getTenantById(id, ctx.session.branchId);
    if (!tenantRow) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    const branchId = ctx.session.branchId;
    const [repoRows, attachRows, contractId] = await Promise.all([
      listRepositoryDocumentsForPortal(id, branchId),
      listTenantAttachmentDocumentsForPortal(id, branchId),
      getPrimaryContractIdForTenant(id, branchId),
    ]);

    const items = [];
    const seenPaths = new Set();

    const hasRepoLease = repoRows.some((r) => r.doc_type === 'lease_contract');
    if (!hasRepoLease && contractId) {
      items.push({
        id: `preview-contract-${contractId}`,
        kind: 'preview',
        previewType: 'contract',
        contractId: String(contractId),
        title: 'Lease contract',
        fileName: 'Lease_Contract.pdf',
        sizeLabel: null,
      });
    }

    items.push({
      id: 'artifact-house-rules',
      kind: 'artifact',
      slug: 'house-rules',
      title: 'House rules handbook',
      fileName: 'House_Rules_Handbook.pdf',
      sizeLabel: null,
    });
    items.push({
      id: 'artifact-move-in-clearance',
      kind: 'artifact',
      slug: 'move-in-clearance',
      title: 'Move-in clearance',
      fileName: 'Move_In_Clearance.pdf',
      sizeLabel: null,
    });

    for (const r of repoRows) {
      const fp = String(r.file_path ?? '').trim();
      if (!fp) continue;
      const downloadPath = normalizeClientDownloadPath(fp);
      if (!downloadPath) continue;
      const sz = await statUploadFileSize(fp);
      items.push({
        id: `repo-${r.id}`,
        kind: 'file',
        title: String(r.title ?? 'Document'),
        fileName: fileNameFromPath(fp, r.title),
        sizeLabel: sz != null ? formatBytes(sz) : null,
        downloadPath,
      });
      seenPaths.add(fp);
    }

    for (const r of attachRows) {
      const fp = String(r.file_path ?? '').trim();
      if (!fp || seenPaths.has(fp)) continue;
      const downloadPath = normalizeClientDownloadPath(fp);
      if (!downloadPath) continue;
      const sz = await statUploadFileSize(fp);
      items.push({
        id: `attach-${r.id}`,
        kind: 'file',
        title: attachmentTitle(r.document_type),
        fileName: fileNameFromPath(fp, attachmentTitle(r.document_type)),
        sizeLabel: sz != null ? formatBytes(sz) : null,
        downloadPath,
      });
      seenPaths.add(fp);
    }

    res.json({ documents: items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load documents' });
  }
}

export async function streamTenantPortalArtifact(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const id = String(req.params.id ?? '').trim();
  const slug = String(req.params.slug ?? '').trim();
  if (!id || !isValidPortalArtifactSlug(slug)) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }
  try {
    const tenantRow = await getTenantById(id, ctx.session.branchId);
    if (!tenantRow) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    const fileName = slug === 'house-rules' ? 'House_Rules_Handbook.pdf' : 'Move_In_Clearance.pdf';
    streamPortalArtifactPdf(res, slug, fileName);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to generate document' });
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
    if (parsed.isBlacklisted) {
      await upsertActiveTenantBlacklist(
        ctx.session.branchId,
        row.id,
        parsed.blacklistReason || 'Blacklisted',
        ctx.session.user.id,
      );
    }
    logTenantAudit(ctx, row.id, 'create', `Registered tenant: ${parsed.name}`);
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
    const existing = await getTenantById(id, ctx.session.branchId);
    if (!existing) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const raw = req.body ?? {};
    const toSave = { ...parsed };
    if (!Object.prototype.hasOwnProperty.call(raw, 'idImageUrl')) {
      toSave.idImageUrl =
        existing.id_image_url != null && String(existing.id_image_url).trim() !== ''
          ? String(existing.id_image_url).trim()
          : null;
    }

    const affectedRows = await updateTenantById(id, ctx.session.branchId, toSave);
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    if (toSave.isBlacklisted) {
      await upsertActiveTenantBlacklist(
        ctx.session.branchId,
        id,
        toSave.blacklistReason || 'Blacklisted',
        ctx.session.user.id,
      );
    } else {
      await deactivateBlacklistForTenant(ctx.session.branchId, id);
    }
    const row = await getTenantById(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    logTenantAudit(ctx, id, 'update', `Updated tenant profile: ${parsed.name}`);
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
    logTenantAudit(ctx, id, 'delete', `Deactivated tenant #${id}`);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    if (e?.errno === 1451 || e?.code === 'ER_ROW_IS_REFERENCED_2') {
      res.status(409).json({
        error:
          'This tenant is still linked to a lease or other records. Remove or reassign those first, then try again.',
      });
      return;
    }
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
}

export async function uploadTenantKycDocument(req, res) {
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
    const existing = await getTenantById(id, ctx.session.branchId);
    if (!existing) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    await insertKycUploadRevision(ctx.session.branchId, id, publicUrl);

    const row = await getTenantById(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    logTenantAudit(ctx, id, 'update', 'Uploaded KYC identity document');
    res.json({ tenant: rowToTenant(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to upload document' });
  }
}

export async function uploadTenantLeaseContract(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  // Allow upload for both create and update flows (register tenant + edits).
  if (!canCrud(ctx.session, 'create') && !canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to upload documents' });
    return;
  }

  const tenantId = String(req.params.id ?? '').trim();
  if (!tenantId) {
    res.status(400).json({ error: 'Invalid tenant id' });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const existing = await getTenantById(tenantId, ctx.session.branchId);
    if (!existing) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to validate tenant' });
    return;
  }

  let filePath;
  try {
    ({ publicUrl: filePath } = await finalizeRepositoryUploadToWebpOrPdf(file));
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

  const titleRaw = String(req.body?.title ?? '').trim();
  const title = titleRaw || 'Lease contract';
  const portalVisibleRaw = String(req.body?.portalVisible ?? req.body?.is_portal_visible ?? '1').trim();
  const portalVisible = portalVisibleRaw === '0' || portalVisibleRaw.toLowerCase() === 'false' ? 0 : 1;

  try {
    const contractId = await getPrimaryContractIdForTenant(tenantId, ctx.session.branchId);
    const repoId = await insertRepositoryDocument(ctx.session.branchId, {
      contractId: contractId ? String(contractId) : null,
      tenantId,
      uploadedBy: ctx.session.user.id,
      docType: 'lease_contract',
      title,
      filePath,
      portalVisible: Boolean(portalVisible),
    });

    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'crm',
      recordTable: 'document_repository',
      recordId: repoId,
      action: 'create',
      changeSummary: `Uploaded lease contract for tenant ${tenantId}: ${title}`,
    });

    res.status(201).json({ ok: true, filePath });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save lease contract' });
  }
}

export async function getTenantLeaseContract(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const tenantId = String(req.params.id ?? '').trim();
  if (!tenantId) {
    res.status(400).json({ error: 'Invalid tenant id' });
    return;
  }
  try {
    const existing = await getTenantById(tenantId, ctx.session.branchId);
    if (!existing) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    const row = await getLatestLeaseContractRepositoryDocForTenant(tenantId, ctx.session.branchId);
    if (!row || !String(row.file_path ?? '').trim()) {
      res.json({ filePath: '' });
      return;
    }
    res.json({ filePath: String(row.file_path).trim(), title: String(row.title ?? '') });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load lease contract' });
  }
}
