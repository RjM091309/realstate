import { loadSessionPayload } from '../services/sessionService.js';
import { logAudit } from '../services/auditLogService.js';
import {
  deleteContractById,
  findOrCreatePartnerAgencyForInvite,
  getContractDocumentDetails,
  getContractById,
  insertContract,
  insertContractCollaboration,
  listContractCollaborations,
  listContractTenants,
  listContractsByBranch,
  updateContractById,
} from '../models/contractsModel.js';

function fmtDate(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** DB ENUM contract_type (see lease_contract in realstate_init.sql) */
const DB_CONTRACT_TYPES = new Set(['monthly_rental', 'selling', 'short_term_rental']);
/** DB ENUM status */
const DB_CONTRACT_STATUSES = new Set(['draft', 'active', 'completed', 'terminated', 'cancelled']);

const UI_TYPE_TO_DB = {
  'Monthly Rental': 'monthly_rental',
  Sales: 'selling',
  'Short-term Rental': 'short_term_rental',
};

const DB_TO_UI_TYPE = {
  monthly_rental: 'Monthly Rental',
  selling: 'Sales',
  short_term_rental: 'Short-term Rental',
};

const UI_STATUS_TO_DB = {
  Active: 'active',
  Expired: 'completed',
  Terminated: 'terminated',
};

const DB_TO_UI_STATUS = {
  draft: 'Active',
  active: 'Active',
  completed: 'Expired',
  terminated: 'Terminated',
  cancelled: 'Terminated',
};

function mapUiTypeToDb(type) {
  const t = String(type ?? '').trim();
  if (DB_CONTRACT_TYPES.has(t)) return t;
  return UI_TYPE_TO_DB[t] ?? 'monthly_rental';
}

function mapDbTypeToUi(type) {
  const t = String(type ?? '').trim();
  return DB_TO_UI_TYPE[t] ?? 'Monthly Rental';
}

function mapUiStatusToDb(status) {
  const s = String(status ?? '').trim();
  if (DB_CONTRACT_STATUSES.has(s)) return s;
  return UI_STATUS_TO_DB[s] ?? 'active';
}

function mapDbStatusToUi(status) {
  const s = String(status ?? '').trim().toLowerCase();
  return DB_TO_UI_STATUS[s] ?? 'Active';
}

/** Accepts UI ids like "a12" or numeric "12"; returns numeric string for FK to user_info.IDNO */
function normalizeAgentId(raw) {
  const s = String(raw ?? '').trim();
  const prefixed = s.match(/^a(\d+)$/i);
  if (prefixed) return prefixed[1];
  if (/^\d+$/.test(s)) return s;
  const digits = s.replace(/\D/g, '');
  return digits || '';
}

function rowToContract(row) {
  const aid = row.agent_id != null && String(row.agent_id).trim() !== '' ? String(row.agent_id) : '';
  const start = fmtDate(row.start_date);
  const ym = /^\d{4}-\d{2}-\d{2}$/.test(start) ? start.slice(0, 7).replace('-', '') : '';
  const idPad = String(row.id ?? '').replace(/\D/g, '').padStart(4, '0');
  const normalized =
    ym && idPad ? `${ym}-${idPad}` : row.contract_no ? String(row.contract_no) : undefined;
  const rawAgentName = row.agent_name != null ? String(row.agent_name).trim() : '';
  return {
    id: String(row.id),
    contractNo: normalized,
    unitId: String(row.unit_id),
    tenantId: String(row.tenant_id),
    agentId: aid ? `a${aid}` : '',
    agentName: rawAgentName || undefined,
    startDate: start,
    endDate: fmtDate(row.end_date),
    monthlyRent: Number(row.monthly_rent),
    securityDeposit: Number(row.security_deposit),
    advanceRent: Number(row.advance_rent),
    type: mapDbTypeToUi(row.contract_type),
    status: mapDbStatusToUi(row.status),
    remarks: row.remarks ? String(row.remarks) : undefined,
  };
}

function validatePayload(body) {
  const unitId = String(body.unitId ?? '').trim();
  const tenantId = String(body.tenantId ?? '').trim();
  const agentId = String(body.agentId ?? '').trim();
  const startDate = String(body.startDate ?? '').trim().slice(0, 10);
  const endDate = String(body.endDate ?? '').trim().slice(0, 10);
  const type = String(body.type ?? '').trim() || 'Monthly Rental';
  const status = String(body.status ?? '').trim() || 'Active';
  if (!unitId || !tenantId || !agentId || !startDate || !endDate) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;

  const monthlyRent = Number(body.monthlyRent);
  const securityDeposit = Number(body.securityDeposit);
  const advanceRent = Number(body.advanceRent ?? monthlyRent);
  if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) return null;
  if (!Number.isFinite(securityDeposit) || securityDeposit < 0) return null;
  if (!Number.isFinite(advanceRent) || advanceRent < 0) return null;

  const remarksRaw = body.remarks;
  const remarks =
    remarksRaw === null || remarksRaw === undefined ? null : String(remarksRaw).trim() || null;

  const agentDigits = normalizeAgentId(agentId);
  if (!agentDigits) return null;

  return {
    unitId,
    tenantId,
    agentId: agentDigits,
    startDate,
    endDate,
    monthlyRent,
    securityDeposit,
    advanceRent,
    type,
    status,
    remarks,
  };
}

/** Maps validated payload to DB column values (ENUMs + numeric agent id). */
function payloadForDatabase(parsed) {
  return {
    ...parsed,
    type: mapUiTypeToDb(parsed.type),
    status: mapUiStatusToDb(parsed.status),
  };
}

function canCrud(session, op) {
  const permissions = session.crud?.contracts;
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

export async function listContracts(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const rows = await listContractsByBranch(ctx.session.branchId);
    res.json({ contracts: rows.map(rowToContract) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load contracts' });
  }
}

export async function createContract(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to create contracts' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid contract payload' });
    return;
  }
  const dbPayload = payloadForDatabase(parsed);
  try {
    const row = await insertContract(ctx.session.branchId, dbPayload);
    if (!row) {
      res.status(500).json({ error: 'Failed to load created contract' });
      return;
    }
    res.status(201).json({ contract: rowToContract(row) });
  } catch (e) {
    console.error(e);
    // Common MySQL constraint errors → return a clear client message.
    if (e?.code === 'ER_NO_REFERENCED_ROW_2' || e?.code === 'ER_NO_REFERENCED_ROW') {
      res.status(400).json({
        error:
          'Invalid unit/tenant/agent reference. Make sure you selected an existing unit and tenant, and that your user account exists.',
      });
      return;
    }
    if (e?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'A contract with the same key already exists.' });
      return;
    }
    const showDetail = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      error: 'Failed to create contract',
      ...(showDetail
        ? {
            detail:
              typeof e?.sqlMessage === 'string'
                ? e.sqlMessage
                : e instanceof Error
                  ? e.message
                  : String(e),
            code: typeof e?.code === 'string' ? e.code : undefined,
          }
        : null),
    });
  }
}

export async function updateContract(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update contracts' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const parsed = validatePayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid contract payload' });
    return;
  }
  const dbPayload = payloadForDatabase(parsed);
  try {
    const affectedRows = await updateContractById(id, ctx.session.branchId, dbPayload);
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    const row = await getContractById(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    res.json({ contract: rowToContract(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update contract' });
  }
}

export async function deleteContract(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete contracts' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const affectedRows = await deleteContractById(id, ctx.session.branchId);
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete contract' });
  }
}

export async function listContractTenantsView(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const rows = await listContractTenants(id, ctx.session.branchId);
    const tenants = rows.map((r) => ({
      contractId: String(r.contract_id),
      tenantId: String(r.tenant_id),
      isPrimary: Boolean(Number(r.is_primary)),
      createdAt: r.created_at ? fmtDate(r.created_at) : '',
      name: r.tenant_name ? String(r.tenant_name) : '—',
      email: r.tenant_email ? String(r.tenant_email) : '',
      phone: r.tenant_phone ? String(r.tenant_phone) : '',
    }));
    res.json({ tenants });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load contract tenants' });
  }
}

export async function listContractCollaborationsView(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const rows = await listContractCollaborations(id, ctx.session.branchId);
    const collaborations = rows.map((r) => ({
      id: String(r.id),
      contractId: String(r.contract_id),
      partnerAgencyId: r.partner_agency_id != null ? String(r.partner_agency_id) : undefined,
      partnerAgencyName: r.partner_agency_name ? String(r.partner_agency_name) : '—',
      commissionTerms: r.commission_terms ? String(r.commission_terms) : '',
      remarks: r.remarks ? String(r.remarks) : '',
      createdBy: r.created_by != null ? String(r.created_by) : '',
      createdAt: r.created_at ? fmtDate(r.created_at) : '',
    }));
    res.json({ collaborations });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load contract collaborations' });
  }
}

function validateCreateCollaborationInvite(body) {
  const name = String(body?.name ?? '').trim();
  const email = String(body?.email ?? '').trim();
  const commissionTerms = body?.commissionTerms == null ? null : String(body.commissionTerms).trim() || null;
  const remarks = body?.remarks == null ? null : String(body.remarks).trim() || null;
  if (!name && !email) return null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { name, email, commissionTerms, remarks };
}

export async function createContractCollaborationInvite(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to add collaborators' });
    return;
  }

  const contractId = String(req.params.id ?? '').trim();
  if (!contractId) {
    res.status(400).json({ error: 'Invalid contract id' });
    return;
  }

  const parsed = validateCreateCollaborationInvite(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid invite payload' });
    return;
  }

  try {
    const partnerAgencyId = await findOrCreatePartnerAgencyForInvite(ctx.session.branchId, parsed.name, parsed.email);
    await insertContractCollaboration(ctx.session.branchId, contractId, {
      partnerAgencyId,
      commissionTerms: parsed.commissionTerms,
      remarks: parsed.remarks,
      createdBy: ctx.session.user.id,
    });

    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'contracts',
      recordTable: 'contract_collaboration',
      recordId: null,
      action: 'create',
      changeSummary: `Invited collaborator: ${parsed.email || parsed.name || '—'} (contract ${contractId})`,
    });

    const rows = await listContractCollaborations(contractId, ctx.session.branchId);
    const collaborations = rows.map((r) => ({
      id: String(r.id),
      contractId: String(r.contract_id),
      partnerAgencyId: r.partner_agency_id != null ? String(r.partner_agency_id) : undefined,
      partnerAgencyName: r.partner_agency_name ? String(r.partner_agency_name) : '—',
      commissionTerms: r.commission_terms ? String(r.commission_terms) : '',
      remarks: r.remarks ? String(r.remarks) : '',
      createdBy: r.created_by != null ? String(r.created_by) : '',
      createdAt: r.created_at ? fmtDate(r.created_at) : '',
    }));
    res.status(201).json({ collaborations });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to invite collaborator' });
  }
}

function rowToContractDocumentDto(r) {
  return {
    contract: {
      id: String(r.contract_id),
      contractNo: r.contract_no ? String(r.contract_no) : undefined,
      unitId: String(r.unit_id),
      tenantId: r.tenant_id != null ? String(r.tenant_id) : '',
      agentId: r.agent_id != null ? `a${String(r.agent_id)}` : '',
      startDate: fmtDate(r.start_date),
      endDate: fmtDate(r.end_date),
      monthlyRent: Number(r.monthly_rent ?? 0),
      securityDeposit: Number(r.security_deposit ?? 0),
      advanceRent: Number(r.advance_rent ?? 0),
      type: mapDbTypeToUi(r.contract_type),
      status: mapDbStatusToUi(r.status),
      remarks: r.contract_remarks ? String(r.contract_remarks) : undefined,
    },
    unit: {
      id: String(r.unit_id),
      unitNumber: r.unit_number ? String(r.unit_number) : '',
      floor: r.unit_floor ? String(r.unit_floor) : '',
      tower: r.unit_tower ? String(r.unit_tower) : '',
      buildingName: r.building_name ? String(r.building_name) : '',
      commonAddress: r.common_address ? String(r.common_address) : '',
      legalAddress: r.legal_address ? String(r.legal_address) : '',
    },
    tenant: r.tenant_id
      ? {
          id: String(r.tenant_id),
          name: r.tenant_name ? String(r.tenant_name) : '',
          email: r.tenant_email ? String(r.tenant_email) : '',
          phone: r.tenant_phone ? String(r.tenant_phone) : '',
        }
      : null,
    landlord: r.landlord_id2
      ? {
          id: String(r.landlord_id2),
          fullName: r.landlord_name ? String(r.landlord_name) : '',
          mobileNo: r.landlord_phone ? String(r.landlord_phone) : '',
          email: r.landlord_email ? String(r.landlord_email) : '',
          govIdNo: r.landlord_gov_id_no ? String(r.landlord_gov_id_no) : '',
        }
      : null,
  };
}

export async function getContractDocumentDetailsView(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const row = await getContractDocumentDetails(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    res.json(rowToContractDocumentDto(row));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load contract document details' });
  }
}
