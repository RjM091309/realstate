import { loadSessionPayload } from '../services/sessionService.js';
import { logAudit } from '../services/auditLogService.js';
import { assertTenantNotBlacklisted } from '../services/blacklistCheckService.js';
import {
  deleteContractById,
  findOrCreatePartnerAgencyForInvite,
  getContractDocumentDetails,
  getContractById,
  insertContract,
  insertContractCollaboration,
  listContractCollaborations,
  listContractTenants,
  listArchivedContractsByBranch,
  listContractsByBranch,
  renewLeaseContract,
  updateContractById,
  updateContractCollaboration,
  updateContractTenantRemarks,
} from '../models/contractsModel.js';
import { listInventorySnapshotsByContract } from '../models/inventorySnapshotsModel.js';
import {
  getInspectionByContractId,
  insertInspectionLog,
  isContractInspectionApproved,
  updateInspectionFields,
} from '../models/unitInspectionsModel.js';

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
  'Pending Inspection': 'draft',
  Active: 'active',
  Expired: 'completed',
  Terminated: 'terminated',
};

const DB_TO_UI_STATUS = {
  draft: 'Pending Inspection',
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
    createdAt: row.created_at != null ? fmtDateTime(row.created_at) : '',
  };
}

function collaborationRowToDto(r) {
  return {
    id: String(r.id),
    contractId: String(r.contract_id),
    partnerAgencyId: r.partner_agency_id != null ? String(r.partner_agency_id) : undefined,
    partnerAgencyName: r.partner_agency_name ? String(r.partner_agency_name) : '—',
    email: r.partner_email ? String(r.partner_email) : '',
    commissionTerms: r.commission_terms ? String(r.commission_terms) : '',
    remarks: r.remarks ? String(r.remarks) : '',
    createdBy: r.created_by != null ? String(r.created_by) : '',
    createdAt: r.created_at ? fmtDate(r.created_at) : '',
  };
}

function tenantRowToDto(r) {
  return {
    contractId: String(r.contract_id),
    tenantId: String(r.tenant_id),
    isPrimary: Boolean(Number(r.is_primary)),
    remarks: r.remarks ? String(r.remarks) : '',
    createdAt: r.created_at ? fmtDate(r.created_at) : '',
    name: r.tenant_name ? String(r.tenant_name) : '—',
    email: r.tenant_email ? String(r.tenant_email) : '',
    phone: r.tenant_phone ? String(r.tenant_phone) : '',
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

async function assertCanActivateContract(contractId, branchId) {
  if (await isContractInspectionApproved(contractId, branchId)) {
    return true;
  }
  const snaps = await listInventorySnapshotsByContract(contractId, branchId);
  return Boolean(snaps && snaps.length > 0);
}

function contractRowToActivatePayload(row) {
  return {
    unitId: String(row.unit_id),
    tenantId: String(row.tenant_id ?? ''),
    agentId: String(row.agent_id ?? ''),
    startDate: fmtDate(row.start_date),
    endDate: fmtDate(row.end_date),
    monthlyRent: Number(row.monthly_rent),
    securityDeposit: Number(row.security_deposit),
    advanceRent: Number(row.advance_rent),
    type: mapDbTypeToUi(row.contract_type),
    status: 'Active',
    remarks: row.remarks ? String(row.remarks) : null,
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
  return { session };
}

export async function listContracts(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const archivedRaw = req.query?.archived;
  const archived =
    archivedRaw === '1' ||
    archivedRaw === 'true' ||
    String(archivedRaw ?? '').toLowerCase() === 'yes';
  try {
    const rows = archived
      ? await listArchivedContractsByBranch(ctx.session.branchId)
      : await listContractsByBranch(ctx.session.branchId);
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
  if (!(await assertTenantNotBlacklisted(res, ctx.session.branchId, parsed.tenantId))) {
    return;
  }
  const dbPayload = payloadForDatabase(parsed);
  if (String(dbPayload.status).toLowerCase() === 'active') {
    res.status(409).json({
      error:
        'Inspection required before activation. Create the contract as Pending Inspection, complete an inventory inspection, then activate.',
    });
    return;
  }
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
  if (String(dbPayload.status).toLowerCase() === 'active') {
    try {
      const canActivate = await assertCanActivateContract(id, ctx.session.branchId);
      if (!canActivate) {
        res.status(409).json({
          error:
            'Complete the unit inspection workflow before activating this lease.',
        });
        return;
      }
      if (!(await assertTenantNotBlacklisted(res, ctx.session.branchId, parsed.tenantId))) {
        return;
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to validate inspection requirement' });
      return;
    }
  }
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

export async function activateContract(req, res) {
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
  const row = await getContractById(id, ctx.session.branchId);
  if (!row) {
    res.status(404).json({ error: 'Contract not found' });
    return;
  }
  if (mapDbStatusToUi(row.status) !== 'Pending Inspection') {
    res.status(400).json({ error: 'Only pending inspection leases can be activated.' });
    return;
  }
  try {
    const canActivate = await assertCanActivateContract(id, ctx.session.branchId);
    if (!canActivate) {
      res.status(409).json({
        error: 'Complete the unit inspection workflow before activating this lease.',
      });
      return;
    }
    const parsed = contractRowToActivatePayload(row);
    if (!parsed.tenantId || !parsed.agentId) {
      res.status(400).json({ error: 'Contract is missing tenant or agent details.' });
      return;
    }
    if (!(await assertTenantNotBlacklisted(res, ctx.session.branchId, parsed.tenantId))) {
      return;
    }
    const dbPayload = payloadForDatabase(parsed);
    const affectedRows = await updateContractById(id, ctx.session.branchId, dbPayload);
    if (affectedRows === 0) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    const inspection = await getInspectionByContractId(id, ctx.session.branchId);
    if (inspection) {
      await updateInspectionFields(String(inspection.id), ctx.session.branchId, { status: 'occupied' });
      await insertInspectionLog(
        String(inspection.id),
        'lease_activated',
        'Lease activated. Unit marked as occupied.',
        ctx.userId,
      );
    }
    const updated = await getContractById(id, ctx.session.branchId);
    res.json({ contract: rowToContract(updated) });
  } catch (e) {
    console.error('[contracts] activateContract', e);
    res.status(500).json({ error: 'Failed to activate lease' });
  }
}

function validateRenewPayload(body) {
  const startDate = String(body?.startDate ?? '').trim().slice(0, 10);
  const endDate = String(body?.endDate ?? '').trim().slice(0, 10);
  const monthlyRent = Number(body?.monthlyRent);
  const rawHandling = String(body?.balanceHandling ?? 'carry_over').trim().toLowerCase();
  const balanceHandling = rawHandling === 'require_payment' ? 'require_payment' : 'carry_over';
  const keepHistory = Boolean(body?.keepHistory);
  const notes = body?.notes == null ? null : String(body.notes);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) return null;

  return { startDate, endDate, monthlyRent, balanceHandling, keepHistory, notes };
}

export async function renewContract(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const canRenew =
    canCrud(ctx.session, 'create') || canCrud(ctx.session, 'update');
  if (!canRenew) {
    res.status(403).json({ error: 'No permission to renew contracts' });
    return;
  }
  const oldId = String(req.params.id ?? '').trim();
  if (!oldId) {
    res.status(400).json({ error: 'Invalid contract id' });
    return;
  }
  const parsed = validateRenewPayload(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid renewal payload' });
    return;
  }

  try {
    const result = await renewLeaseContract(ctx.session.branchId, oldId, parsed);
    if (!result.ok) {
      if (result.code === 'NOT_FOUND') {
        res.status(404).json({ error: 'Contract not found' });
        return;
      }
      if (result.code === 'NOT_ACTIVE') {
        res.status(400).json({ error: 'Only active contracts can be renewed' });
        return;
      }
      if (result.code === 'NO_TENANT') {
        res.status(400).json({ error: 'Contract has no primary tenant' });
        return;
      }
      if (result.code === 'BALANCE_DUE') {
        res.status(400).json({ error: 'Tenant must settle balance before renewal' });
        return;
      }
      if (result.code === 'DATE_ORDER') {
        res.status(400).json({ error: 'Lease end date must be after start date' });
        return;
      }
      if (result.code === 'INVALID_RENT') {
        res.status(400).json({ error: 'Monthly rent must be greater than zero' });
        return;
      }
      res.status(400).json({ error: 'Invalid renewal request' });
      return;
    }

    const contractDto = rowToContract(result.contract);
    const actorId = ctx.session.user?.id ?? ctx.session.userId;
    const summary = `Contract renewed — new lease ${contractDto.contractNo ?? contractDto.id} (previous ${result.previousContractId} closed)`;
    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: actorId,
      moduleName: 'contracts',
      recordTable: 'lease_contract',
      recordId: contractDto.id,
      action: 'renew',
      changeSummary: summary,
    });

    res.status(201).json({ contract: contractDto });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to renew contract' });
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
    const tenants = rows.map(tenantRowToDto);
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
    const collaborations = rows.map(collaborationRowToDto);
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
    const collaborations = rows.map(collaborationRowToDto);
    res.status(201).json({ collaborations });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to invite collaborator' });
  }
}

export async function updateContractCollaborationController(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update collaborators' });
    return;
  }

  const contractId = String(req.params.id ?? '').trim();
  const collabId = String(req.params.collabId ?? '').trim();
  if (!contractId || !collabId) {
    res.status(400).json({ error: 'Invalid contract or collab id' });
    return;
  }

  try {
    let affected = 0;
    if (collabId.startsWith('tenant-')) {
      const tenantId = collabId.replace('tenant-', '');
      affected = await updateContractTenantRemarks(
        ctx.session.branchId,
        contractId,
        tenantId,
        {
          remarks: req.body?.remarks ?? null,
          name: req.body?.name,
          email: req.body?.email,
        }
      );
    } else {
      const realCollabId = collabId.startsWith('agency-') ? collabId.replace('agency-', '') : collabId;
      affected = await updateContractCollaboration(
        ctx.session.branchId,
        contractId,
        realCollabId,
        {
          commissionTerms: req.body?.commissionTerms ?? null,
          remarks: req.body?.remarks ?? null,
          name: req.body?.name,
          email: req.body?.email,
        }
      );
    }

    if (affected === 0) {
      res.status(404).json({ error: 'Collaborator not found' });
      return;
    }

    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'contracts',
      recordTable: collabId.startsWith('tenant-') ? 'contract_tenant' : 'contract_collaboration',
      recordId: collabId,
      action: 'update',
      changeSummary: `Updated collaborator (contract ${contractId})`,
    });

    const rows = await listContractCollaborations(contractId, ctx.session.branchId);
    const collaborations = rows.map(collaborationRowToDto);

    const tenantRows = await listContractTenants(contractId, ctx.session.branchId);
    const tenants = tenantRows.map(tenantRowToDto);

    res.json({ collaborations, tenants });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update collaborator' });
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
