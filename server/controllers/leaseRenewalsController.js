import { loadSessionPayload } from '../services/sessionService.js';
import { logAudit } from '../services/auditLogService.js';
import { getContractById } from '../models/contractsModel.js';
import {
  activateRenewal,
  approveManagerRenewal,
  createOrGetRenewalDraft,
  declineRenewal,
  getRenewalReportContext,
  recordAgreementGenerated,
  recordTenantSignature,
  refreshRenewalBalance,
  saveRenewalDraft,
  updateRenewalDraft,
} from '../models/leaseRenewalsModel.js';
import { streamRenewalDraftPdf, streamRenewalStatementPdf } from '../services/leaseRenewalPdfService.js';

function fmtDate(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mapContractRow(row) {
  if (!row) return null;
  const aid = row.agent_id != null && String(row.agent_id).trim() !== '' ? String(row.agent_id) : '';
  return {
    id: String(row.id),
    contractNo: row.contract_no ? String(row.contract_no) : undefined,
    unitId: String(row.unit_id),
    tenantId: row.tenant_id != null ? String(row.tenant_id) : '',
    agentId: aid ? `a${aid}` : '',
    agentName: row.agent_name != null ? String(row.agent_name).trim() || undefined : undefined,
    startDate: fmtDate(row.start_date),
    endDate: fmtDate(row.end_date),
    monthlyRent: Number(row.monthly_rent),
    securityDeposit: Number(row.security_deposit),
    advanceRent: Number(row.advance_rent),
    type: 'Monthly Rental',
    status: 'Active',
    remarks: row.remarks ?? row.special_remarks ?? undefined,
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

function canRead(session) {
  return Boolean(session.crud?.contracts?.update || session.crud?.contracts?.create);
}

function canWrite(session) {
  return Boolean(session.crud?.contracts?.update);
}

function mapError(res, code) {
  const map = {
    NOT_FOUND: [404, 'Renewal not found'],
    NOT_ACTIVE: [400, 'Only active contracts can be renewed'],
    NO_TENANT: [400, 'Contract has no primary tenant'],
    LOCKED: [400, 'Renewal is locked'],
    BALANCE_DUE: [400, 'Outstanding balance must be settled or carry over approved'],
    CARRY_OVER_REASON_REQUIRED: [400, 'Carry over reason is required'],
    APPROVAL_REQUIRED: [400, 'Manager approval is required'],
    SIGNATURE_REQUIRED: [400, 'Tenant signature is required'],
    INVALID_DATES: [400, 'Invalid lease dates'],
    INVALID_RENT: [400, 'Invalid monthly rent'],
    ALREADY_ACTIVE: [400, 'Renewal is already active'],
    DECLINED: [400, 'Renewal was declined'],
  };
  const [status, message] = map[code] ?? [400, code ?? 'Request failed'];
  res.status(status).json({ error: message, code });
}

export async function getContractRenewal(req, res) {
  const auth = await getAuthContext(req, res);
  if (!auth) return;
  if (!canRead(auth.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const branchId = auth.session.branchId;
  const contractId = req.params.contractId;
  const contract = await getContractById(contractId, branchId);
  if (!contract) {
    res.status(404).json({ error: 'Contract not found' });
    return;
  }

  try {
    const result = await createOrGetRenewalDraft(branchId, contractId, auth.userId);
    if (!result.ok) {
      mapError(res, result.code);
      return;
    }

    res.json({
      renewal: result.renewal,
      summary: result.summary,
      newContractPreview: result.newContractPreview,
      approvals: result.approvals,
      logs: result.logs,
      created: result.created,
    });
  } catch (e) {
    console.error('[lease-renewals] getContractRenewal failed:', e);
    res.status(500).json({ error: 'Failed to load renewal workflow' });
  }
}

export async function patchRenewal(req, res) {
  const auth = await getAuthContext(req, res);
  if (!auth) return;
  if (!canWrite(auth.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const branchId = auth.session.branchId;
  const renewalId = req.params.renewalId;
  const body = req.body ?? {};

  const result = await updateRenewalDraft(branchId, renewalId, body, auth.userId);
  if (!result.ok) {
    mapError(res, result.code);
    return;
  }

  res.json({
    renewal: result.renewal,
    summary: result.summary,
    newContractPreview: result.newContractPreview,
    approvals: result.approvals,
    logs: result.logs,
  });
}

export async function postSaveDraft(req, res) {
  const auth = await getAuthContext(req, res);
  if (!auth) return;
  if (!canWrite(auth.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const result = await saveRenewalDraft(auth.session.branchId, req.params.renewalId, auth.userId);
  if (!result.ok) {
    mapError(res, result.code);
    return;
  }

  res.json({
    renewal: result.renewal,
    summary: result.summary,
    newContractPreview: result.newContractPreview,
    approvals: result.approvals,
    logs: result.logs,
  });
}

export async function postRefreshBalance(req, res) {
  const auth = await getAuthContext(req, res);
  if (!auth) return;
  if (!canRead(auth.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const result = await refreshRenewalBalance(auth.session.branchId, req.params.renewalId);
  if (!result.ok) {
    mapError(res, result.code);
    return;
  }

  res.json({
    renewal: result.renewal,
    summary: result.summary,
    newContractPreview: result.newContractPreview,
    approvals: result.approvals,
    logs: result.logs,
  });
}

export async function getDraftPdf(req, res) {
  const auth = await getAuthContext(req, res);
  if (!auth) return;
  if (!canRead(auth.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const context = await getRenewalReportContext(auth.session.branchId, req.params.renewalId);
  if (!context) {
    res.status(404).json({ error: 'Renewal not found' });
    return;
  }

  await recordAgreementGenerated(auth.session.branchId, req.params.renewalId, auth.userId);
  await streamRenewalDraftPdf(res, context);
}

export async function getStatementPdf(req, res) {
  const auth = await getAuthContext(req, res);
  if (!auth) return;
  if (!canRead(auth.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const context = await getRenewalReportContext(auth.session.branchId, req.params.renewalId);
  if (!context) {
    res.status(404).json({ error: 'Renewal not found' });
    return;
  }

  await streamRenewalStatementPdf(res, context);
}

export async function postManagerApproval(req, res) {
  const auth = await getAuthContext(req, res);
  if (!auth) return;
  if (!canWrite(auth.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const result = await approveManagerRenewal(
    auth.session.branchId,
    req.params.renewalId,
    req.body ?? {},
    auth.userId,
  );
  if (!result.ok) {
    mapError(res, result.code);
    return;
  }

  await logAudit({
    branchId: auth.session.branchId,
    actorUserId: auth.userId,
    moduleName: 'contracts',
    recordTable: 'lease_renewals',
    recordId: req.params.renewalId,
    action: 'status_change',
    changeSummary: `Manager ${req.body?.status === 'rejected' ? 'rejected' : 'approved'} lease renewal`,
  });

  res.json({
    renewal: result.renewal,
    summary: result.summary,
    newContractPreview: result.newContractPreview,
    approvals: result.approvals,
    logs: result.logs,
  });
}

export async function postTenantSignature(req, res) {
  const auth = await getAuthContext(req, res);
  if (!auth) return;
  if (!canWrite(auth.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const result = await recordTenantSignature(
    auth.session.branchId,
    req.params.renewalId,
    req.body ?? {},
    auth.userId,
  );
  if (!result.ok) {
    mapError(res, result.code);
    return;
  }

  res.json({
    renewal: result.renewal,
    summary: result.summary,
    newContractPreview: result.newContractPreview,
    approvals: result.approvals,
    logs: result.logs,
  });
}

export async function postActivateRenewal(req, res) {
  const auth = await getAuthContext(req, res);
  if (!auth) return;
  if (!canWrite(auth.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const result = await activateRenewal(
    auth.session.branchId,
    req.params.renewalId,
    req.body ?? {},
    auth.userId,
  );
  if (!result.ok) {
    mapError(res, result.code);
    return;
  }

  await logAudit({
    branchId: auth.session.branchId,
    actorUserId: auth.userId,
    moduleName: 'contracts',
    recordTable: 'lease_renewals',
    recordId: req.params.renewalId,
    action: 'create',
    changeSummary: `Activated lease renewal — new contract ${result.contract?.contractNo ?? result.contract?.id}`,
  });

  res.json({
    contract: mapContractRow(result.contract),
    previousContractId: result.previousContractId,
    renewal: result.renewal,
    summary: result.summary,
    newContractPreview: result.newContractPreview,
    approvals: result.approvals,
    logs: result.logs,
  });
}

export async function postDeclineRenewal(req, res) {
  const auth = await getAuthContext(req, res);
  if (!auth) return;
  if (!canWrite(auth.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const result = await declineRenewal(
    auth.session.branchId,
    req.params.renewalId,
    auth.userId,
    req.body?.reason,
  );
  if (!result.ok) {
    mapError(res, result.code);
    return;
  }

  res.json({
    renewal: result.renewal,
    summary: result.summary,
    newContractPreview: result.newContractPreview,
    approvals: result.approvals,
    logs: result.logs,
  });
}
