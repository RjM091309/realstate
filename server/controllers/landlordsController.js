import { loadSessionPayload } from '../services/sessionService.js';
import { logAudit } from '../services/auditLogService.js';
import { finalizeKycUploadToWebpOrPdf } from '../services/kycUploadService.js';
import { listAuditLogsByBranch } from '../models/auditLogsModel.js';
import {
  deactivateLandlordById,
  getLandlordById,
  insertLandlord,
  insertLandlordDocument,
  listLandlordContracts,
  listLandlordDocuments,
  listLandlordProperties,
  listLandlordTransactions,
  listLandlordsByBranch,
  touchLandlordActivity,
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

async function loadLandlordDetailPart(label, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(`[landlord detail] ${label} failed:`, e);
    return [];
  }
}

function composeFullName(firstName, middleName, lastName, fallback = '') {
  const parts = [firstName, middleName, lastName].map((p) => String(p ?? '').trim()).filter(Boolean);
  if (parts.length) return parts.join(' ');
  return String(fallback ?? '').trim();
}

function rowToLandlord(row) {
  const firstName = row.first_name ? String(row.first_name) : '';
  const middleName = row.middle_name ? String(row.middle_name) : '';
  const lastName = row.last_name ? String(row.last_name) : '';
  const fullName =
    String(row.full_name ?? '').trim() || composeFullName(firstName, middleName, lastName);

  return {
    id: String(row.id),
    fullName,
    firstName,
    middleName,
    lastName,
    companyName: row.company_name ? String(row.company_name) : '',
    mobileNo: row.mobile_no ? String(row.mobile_no) : '',
    email: row.email ? String(row.email) : '',
    birthDate: row.birth_date != null ? fmtDate(row.birth_date) : '',
    address: row.address ? String(row.address) : '',
    city: row.city ? String(row.city) : '',
    province: row.province ? String(row.province) : '',
    postalCode: row.postal_code ? String(row.postal_code) : '',
    govIdNo: row.gov_id_no ? String(row.gov_id_no) : row.id_number ? String(row.id_number) : '',
    idType: row.id_type ? String(row.id_type) : '',
    idNumber: row.id_number ? String(row.id_number) : row.gov_id_no ? String(row.gov_id_no) : '',
    idFrontUrl: row.id_front_url ? String(row.id_front_url) : '',
    idBackUrl: row.id_back_url ? String(row.id_back_url) : '',
    tin: row.tin ? String(row.tin) : '',
    proofOfAddressUrl: row.proof_of_address_url ? String(row.proof_of_address_url) : '',
    bankName: row.bank_name ? String(row.bank_name) : '',
    accountName: row.account_name ? String(row.account_name) : '',
    accountNumber: row.account_number ? String(row.account_number) : '',
    gcash: row.gcash ? String(row.gcash) : '',
    maya: row.maya ? String(row.maya) : '',
    internalNotes: row.internal_notes ? String(row.internal_notes) : '',
    kycStatus: row.kyc_status ? String(row.kyc_status) : 'pending',
    accountStatus: row.account_status ? String(row.account_status) : 'active',
    assignedAgentId: row.assigned_agent_id != null ? String(row.assigned_agent_id) : '',
    assignedAgentName: row.assigned_agent_name ? String(row.assigned_agent_name) : '',
    propertyCount: Number(row.property_count ?? 0),
    totalUnits: Number(row.total_units ?? 0),
    monthlyRentalIncome: Number(row.monthly_rental_income ?? 0),
    lastActivity: row.last_activity != null ? fmtDateTime(row.last_activity) : '',
    active: Boolean(Number(row.active)),
    createdAt: row.created_at != null ? fmtDateTime(row.created_at) : '',
    updatedAt: row.updated_at != null ? fmtDateTime(row.updated_at) : '',
  };
}

function validatePayload(body) {
  const firstName = String(body?.firstName ?? body?.first_name ?? '').trim();
  const middleName = String(body?.middleName ?? body?.middle_name ?? '').trim();
  const lastName = String(body?.lastName ?? body?.last_name ?? '').trim();
  const legacyFullName = String(body?.fullName ?? body?.full_name ?? '').trim();
  const fullName = composeFullName(firstName, middleName, lastName, legacyFullName);
  if (!fullName) return null;
  if (fullName.length > 180) return null;

  const str = (v, max) => {
    if (v === null || v === undefined) return '';
    const s = String(v).trim();
    return s ? s.slice(0, max) : '';
  };

  const kycStatus = String(body?.kycStatus ?? body?.kyc_status ?? 'pending').toLowerCase();
  const accountStatus = String(body?.accountStatus ?? body?.account_status ?? 'active').toLowerCase();

  return {
    fullName,
    firstName: str(firstName, 80),
    middleName: str(middleName, 80),
    lastName: str(lastName, 80),
    companyName: str(body?.companyName ?? body?.company_name, 180),
    mobileNo: str(body?.mobileNo ?? body?.mobile_no, 40) || null,
    email: str(body?.email, 180) || null,
    birthDate: str(body?.birthDate ?? body?.birth_date, 10) || null,
    address: str(body?.address, 255) || null,
    city: str(body?.city, 100) || null,
    province: str(body?.province, 100) || null,
    postalCode: str(body?.postalCode ?? body?.postal_code, 20) || null,
    govIdNo: str(body?.govIdNo ?? body?.gov_id_no ?? body?.idNumber ?? body?.id_number, 100) || null,
    idType: str(body?.idType ?? body?.id_type, 60) || null,
    idNumber: str(body?.idNumber ?? body?.id_number ?? body?.govIdNo ?? body?.gov_id_no, 100) || null,
    idFrontUrl: str(body?.idFrontUrl ?? body?.id_front_url, 512) || null,
    idBackUrl: str(body?.idBackUrl ?? body?.id_back_url, 512) || null,
    tin: str(body?.tin, 40) || null,
    proofOfAddressUrl: str(body?.proofOfAddressUrl ?? body?.proof_of_address_url, 512) || null,
    bankName: str(body?.bankName ?? body?.bank_name, 120) || null,
    accountName: str(body?.accountName ?? body?.account_name, 180) || null,
    accountNumber: str(body?.accountNumber ?? body?.account_number, 60) || null,
    gcash: str(body?.gcash, 40) || null,
    maya: str(body?.maya, 40) || null,
    internalNotes: str(body?.internalNotes ?? body?.internal_notes, 5000) || null,
    kycStatus: ['verified', 'rejected'].includes(kycStatus) ? kycStatus : 'pending',
    accountStatus: ['inactive', 'suspended'].includes(accountStatus) ? accountStatus : 'active',
    assignedAgentId:
      body?.assignedAgentId != null && String(body.assignedAgentId).trim() !== ''
        ? Number(body.assignedAgentId)
        : null,
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

export async function getLandlordDetail(req, res) {
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

    const [properties, contracts, documents, transactions, auditRows] = await Promise.all([
      loadLandlordDetailPart('properties', () => listLandlordProperties(id, ctx.session.branchId)),
      loadLandlordDetailPart('contracts', () => listLandlordContracts(id, ctx.session.branchId)),
      loadLandlordDetailPart('documents', () => listLandlordDocuments(id, ctx.session.branchId)),
      loadLandlordDetailPart('transactions', () => listLandlordTransactions(id, ctx.session.branchId)),
      loadLandlordDetailPart('activityLogs', () =>
        listAuditLogsByBranch(ctx.session.branchId, {
          recordTable: 'landlord_profile',
          recordId: id,
          limit: 50,
        }),
      ),
    ]);

    res.json({
      landlord: rowToLandlord(row),
      properties: properties.map((p) => ({
        id: String(p.id),
        name: String(p.name ?? ''),
        propertyType: String(p.property_type ?? ''),
        address: String(p.common_address ?? ''),
        units: Number(p.units ?? 0),
        occupied: Number(p.occupied ?? 0),
        vacant: Number(p.vacant ?? 0),
        monthlyIncome: Number(p.monthly_income ?? 0),
        status: Number(p.active) ? 'Active' : 'Inactive',
      })),
      contracts: contracts.map((c) => ({
        id: String(c.id),
        contractNo: String(c.contract_no ?? ''),
        startDate: fmtDate(c.start_date),
        endDate: fmtDate(c.end_date),
        monthlyRent: Number(c.monthly_rent ?? 0),
        status: String(c.status ?? ''),
        unitNo: String(c.unit_no ?? ''),
        propertyName: String(c.property_name ?? ''),
        createdAt: c.created_at != null ? fmtDateTime(c.created_at) : '',
      })),
      documents: documents.map((d) => ({
        id: String(d.id),
        documentType: String(d.document_type ?? 'other'),
        title: String(d.title ?? ''),
        filePath: String(d.file_path ?? ''),
        uploadedByName: d.uploaded_by_name ? String(d.uploaded_by_name) : '',
        createdAt: d.created_at != null ? fmtDateTime(d.created_at) : '',
      })),
      transactions: transactions.map((t) => ({
        id: String(t.id),
        amountPaid: Number(t.amount_paid ?? 0),
        paymentDate: fmtDate(t.payment_date),
        paymentMethod: String(t.payment_method ?? ''),
        referenceNo: t.reference_no ? String(t.reference_no) : '',
        contractNo: String(t.contract_no ?? ''),
        propertyName: String(t.property_name ?? ''),
        unitNo: String(t.unit_no ?? ''),
        createdAt: t.created_at != null ? fmtDateTime(t.created_at) : '',
      })),
      activityLogs: auditRows.map((log) => ({
        id: String(log.id),
        action: String(log.action ?? ''),
        changeSummary: log.change_summary ? String(log.change_summary) : '',
        actorUserId: log.actor_user_id != null ? String(log.actor_user_id) : '',
        createdAt: log.created_at != null ? fmtDateTime(log.created_at) : '',
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load landlord detail' });
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
      changeSummary: `Archived landlord id=${id}`,
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

const DOC_FIELD_MAP = {
  id_front: 'idFrontUrl',
  id_back: 'idBackUrl',
  proof_of_address: 'proofOfAddressUrl',
};

export async function uploadLandlordKycFile(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update landlords' });
    return;
  }

  const id = String(req.params.id ?? '').trim();
  const field = String(req.params.field ?? '').trim();
  const mappedField = DOC_FIELD_MAP[field];
  if (!id || !mappedField) {
    res.status(400).json({ error: 'Invalid upload target' });
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
    const existing = await getLandlordById(id, ctx.session.branchId);
    if (!existing) {
      res.status(404).json({ error: 'Landlord not found' });
      return;
    }

    const current = rowToLandlord(existing);
    const payload = validatePayload({
      ...current,
      [mappedField]: publicUrl,
    });
    if (!payload) {
      res.status(400).json({ error: 'Invalid landlord payload' });
      return;
    }
    payload[mappedField] = publicUrl;
    await updateLandlordById(id, ctx.session.branchId, payload);
    await touchLandlordActivity(id, ctx.session.branchId);

    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'crm',
      recordTable: 'landlord_profile',
      recordId: Number(id),
      action: 'update',
      changeSummary: `Uploaded landlord ${field.replace(/_/g, ' ')}`,
    });

    const row = await getLandlordById(id, ctx.session.branchId);
    res.json({ landlord: rowToLandlord(row), url: publicUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save upload' });
  }
}

export async function uploadLandlordDocument(req, res) {
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

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const documentType = String(req.body?.documentType ?? req.body?.document_type ?? 'other').trim();
  const title = String(req.body?.title ?? file.originalname ?? 'Document').trim().slice(0, 180);

  let publicUrl;
  try {
    ({ publicUrl } = await finalizeKycUploadToWebpOrPdf(file));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to upload document' });
    return;
  }

  try {
    const existing = await getLandlordById(id, ctx.session.branchId);
    if (!existing) {
      res.status(404).json({ error: 'Landlord not found' });
      return;
    }

    const docId = await insertLandlordDocument(ctx.session.branchId, id, {
      documentType,
      title,
      filePath: publicUrl,
      uploadedBy: ctx.session.user.id,
    });
    await touchLandlordActivity(id, ctx.session.branchId);

    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'crm',
      recordTable: 'landlord_profile',
      recordId: Number(id),
      action: 'update',
      changeSummary: `Uploaded document: ${title}`,
    });

    const documents = await listLandlordDocuments(id, ctx.session.branchId);
    res.status(201).json({
      document: {
        id: String(docId),
        documentType,
        title,
        filePath: publicUrl,
        createdAt: fmtDateTime(new Date()),
      },
      documents: documents.map((d) => ({
        id: String(d.id),
        documentType: String(d.document_type ?? 'other'),
        title: String(d.title ?? ''),
        filePath: String(d.file_path ?? ''),
        uploadedByName: d.uploaded_by_name ? String(d.uploaded_by_name) : '',
        createdAt: d.created_at != null ? fmtDateTime(d.created_at) : '',
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save document' });
  }
}
