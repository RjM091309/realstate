import { loadSessionPayload } from '../services/sessionService.js';
import { logAudit } from '../services/auditLogService.js';
import {
  listActiveTemplatesByBranch,
  getNextTemplateVersion,
  insertRepositoryDocument,
  insertDocumentTemplate,
  listRepositoryDocumentsForContract,
} from '../models/documentsModel.js';
import { getContractById } from '../models/contractsModel.js';
import { finalizeRepositoryUploadToWebpOrPdf } from '../services/repositoryUploadService.js';
import { finalizeTemplateUploadToWebpOrPdf } from '../services/templateUploadService.js';

function fmtDate(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

export async function listDocumentTemplates(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const templateKey = req.query?.template_key ?? req.query?.templateKey ?? null;
  try {
    const rows = await listActiveTemplatesByBranch(ctx.session.branchId, templateKey);
    const templates = rows.map((r) => ({
      id: String(r.id),
      templateKey: String(r.template_key ?? ''),
      title: String(r.title ?? ''),
      filePath: String(r.file_path ?? ''),
      versionNo: Number(r.version_no ?? 1),
      createdAt: r.created_at ? fmtDate(r.created_at) : '',
    }));
    res.json({ templates });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load templates' });
  }
}

export async function listContractRepositoryDocuments(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const id = String(req.params.contractId ?? req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid contractId' });
    return;
  }
  try {
    const contract = await getContractById(id, ctx.session.branchId);
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    const rows = await listRepositoryDocumentsForContract(id, ctx.session.branchId);
    const documents = rows.map((r) => ({
      id: String(r.id),
      contractId: r.contract_id != null ? String(r.contract_id) : undefined,
      tenantId: r.tenant_id != null ? String(r.tenant_id) : undefined,
      docType: String(r.doc_type ?? 'other'),
      title: String(r.title ?? 'Document'),
      filePath: String(r.file_path ?? ''),
      portalVisible: Boolean(Number(r.is_portal_visible)),
      createdAt: r.created_at ? fmtDate(r.created_at) : '',
    }));
    res.json({ documents });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load documents' });
  }
}

function validateTemplateCreate(body) {
  const templateKey = String(body?.templateKey ?? body?.template_key ?? '').trim();
  const title = String(body?.title ?? '').trim();
  if (!templateKey || templateKey.length > 80) return null;
  if (!title || title.length > 180) return null;
  const isActive = parsePortalVisible(body?.isActive ?? body?.is_active ?? true);
  return { templateKey, title, isActive };
}

export async function createDocumentTemplate(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;

  const parsed = validateTemplateCreate(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid template payload' });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  let filePath;
  try {
    ({ publicUrl: filePath } = await finalizeTemplateUploadToWebpOrPdf(file));
  } catch (e) {
    const code = typeof e?.statusCode === 'number' ? e.statusCode : 500;
    const msg = e instanceof Error ? e.message : 'Failed to process upload';
    if (code >= 400 && code < 500) {
      res.status(code).json({ error: msg });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to upload template' });
    return;
  }

  try {
    const versionNo = await getNextTemplateVersion(ctx.session.branchId, parsed.templateKey);
    const templateId = await insertDocumentTemplate(ctx.session.branchId, {
      templateKey: parsed.templateKey,
      title: parsed.title,
      filePath,
      versionNo,
      isActive: parsed.isActive,
      createdBy: ctx.session.user.id,
    });

    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'documents',
      recordTable: 'document_template',
      recordId: templateId,
      action: 'create',
      changeSummary: `Uploaded template ${parsed.templateKey} v${versionNo}: ${parsed.title}`,
    });

    const rows = await listActiveTemplatesByBranch(ctx.session.branchId, null);
    const templates = rows.map((r) => ({
      id: String(r.id),
      templateKey: String(r.template_key ?? ''),
      title: String(r.title ?? ''),
      filePath: String(r.file_path ?? ''),
      versionNo: Number(r.version_no ?? 1),
      createdAt: r.created_at ? fmtDate(r.created_at) : '',
    }));
    res.status(201).json({ templates });
  } catch (e) {
    console.error(e);
    if (e?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Template version already exists. Try again.' });
      return;
    }
    res.status(500).json({ error: 'Failed to save template' });
  }
}

const ALLOWED_REPO_DOC_TYPES = new Set([
  'lease_contract',
  'invoice',
  'kyc',
  'receipt',
  'move_in_out',
  'other',
]);

function parsePortalVisible(v) {
  if (v === true || v === false) return v;
  if (v === 1 || v === 0) return Boolean(v);
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  return false;
}

function validateRepositoryCreate(body) {
  const title = String(body?.title ?? '').trim();
  if (!title) return null;
  if (title.length > 180) return null;
  const docTypeRaw = String(body?.docType ?? body?.doc_type ?? 'other').trim();
  const docType = ALLOWED_REPO_DOC_TYPES.has(docTypeRaw) ? docTypeRaw : 'other';
  const tenantIdRaw = body?.tenantId ?? body?.tenant_id ?? null;
  const tenantId =
    tenantIdRaw === null || tenantIdRaw === undefined || String(tenantIdRaw).trim() === ''
      ? null
      : String(tenantIdRaw).trim();
  const portalVisible = parsePortalVisible(body?.portalVisible ?? body?.is_portal_visible ?? false);
  return { title, docType, tenantId, portalVisible };
}

export async function createContractRepositoryDocument(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const contractId = String(req.params.contractId ?? '').trim();
  if (!contractId) {
    res.status(400).json({ error: 'Invalid contractId' });
    return;
  }

  const parsed = validateRepositoryCreate(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid document payload' });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  let contract;
  try {
    contract = await getContractById(contractId, ctx.session.branchId);
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to validate contract' });
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

  try {
    const tenantIdFromContract =
      contract?.tenant_id != null && String(contract.tenant_id).trim() !== ''
        ? String(contract.tenant_id)
        : null;
    const effectiveTenantId = parsed.tenantId ?? tenantIdFromContract;

    const repoId = await insertRepositoryDocument(ctx.session.branchId, {
      contractId,
      tenantId: effectiveTenantId,
      uploadedBy: ctx.session.user.id,
      docType: parsed.docType,
      title: parsed.title,
      filePath,
      portalVisible: parsed.portalVisible,
    });

    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'documents',
      recordTable: 'document_repository',
      recordId: repoId,
      action: 'create',
      changeSummary: `Uploaded repository doc (${parsed.docType}) "${parsed.title}" for contract ${contractId}`,
    });

    const rows = await listRepositoryDocumentsForContract(contractId, ctx.session.branchId);
    const documents = rows.map((r) => ({
      id: String(r.id),
      contractId: r.contract_id != null ? String(r.contract_id) : undefined,
      tenantId: r.tenant_id != null ? String(r.tenant_id) : undefined,
      docType: String(r.doc_type ?? 'other'),
      title: String(r.title ?? 'Document'),
      filePath: String(r.file_path ?? ''),
      portalVisible: Boolean(Number(r.is_portal_visible)),
      createdAt: r.created_at ? fmtDate(r.created_at) : '',
    }));
    res.status(201).json({ documents });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save document' });
  }
}

