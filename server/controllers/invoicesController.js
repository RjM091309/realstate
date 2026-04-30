import { loadSessionPayload } from '../services/sessionService.js';
import { logAudit } from '../services/auditLogService.js';
import { getContractById } from '../models/contractsModel.js';
import {
  getInvoiceById,
  insertInvoice,
  listInvoicesByContract,
  updateInvoiceStatusById,
} from '../models/invoicesModel.js';

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

function rowToInvoice(r) {
  return {
    id: String(r.id),
    branchId: String(r.branch_id),
    invoiceNo: String(r.invoice_no ?? ''),
    contractId: String(r.contract_id),
    billingPeriodStart: fmtDate(r.billing_period_start),
    billingPeriodEnd: fmtDate(r.billing_period_end),
    dueDate: fmtDate(r.due_date),
    baseAmount: Number(r.base_amount ?? 0),
    otherCharges: Number(r.other_charges ?? 0),
    discountAmount: Number(r.discount_amount ?? 0),
    totalAmount: Number(r.total_amount ?? 0),
    status: String(r.status ?? 'draft'),
    issuedAt: r.issued_at ? fmtDateTime(r.issued_at) : '',
    createdBy: r.created_by != null ? String(r.created_by) : '',
    createdAt: r.created_at ? fmtDateTime(r.created_at) : '',
  };
}

function canCrud(session, op) {
  // Invoices are generated from both the Ledger and Contracts screens.
  // Prefer ledger permissions, but allow contracts permissions as fallback
  // so staff who can manage contracts can also generate invoices.
  const ledger = session.crud?.ledger;
  const contracts = session.crud?.contracts;
  const permissions = ledger ?? contracts;
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

function makeInvoiceNo(contractId) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(100 + Math.random() * 900));
  return `INV-${y}${m}-${contractId}-${Date.now()}-${rand}`.slice(0, 60);
}

function validateCreate(body) {
  const billingPeriodStart = String(body?.billingPeriodStart ?? '').trim().slice(0, 10);
  const billingPeriodEnd = String(body?.billingPeriodEnd ?? '').trim().slice(0, 10);
  const dueDate = String(body?.dueDate ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(billingPeriodStart)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(billingPeriodEnd)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;

  const baseAmount = Number(body?.baseAmount ?? body?.base_amount ?? 0);
  const otherCharges = Number(body?.otherCharges ?? body?.other_charges ?? 0);
  const discountAmount = Number(body?.discountAmount ?? body?.discount_amount ?? 0);
  if (![baseAmount, otherCharges, discountAmount].every((n) => Number.isFinite(n) && n >= 0)) return null;

  const totalAmount = Number((baseAmount + otherCharges - discountAmount).toFixed(2));
  if (!Number.isFinite(totalAmount) || totalAmount < 0) return null;

  const statusRaw = String(body?.status ?? 'draft').trim().toLowerCase();
  const allowed = new Set(['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void']);
  const status = allowed.has(statusRaw) ? statusRaw : 'draft';
  return { billingPeriodStart, billingPeriodEnd, dueDate, baseAmount, otherCharges, discountAmount, totalAmount, status };
}

function validatePatch(body) {
  const statusRaw = String(body?.status ?? '').trim().toLowerCase();
  const allowed = new Set(['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void']);
  if (!allowed.has(statusRaw)) return null;
  return { status: statusRaw };
}

export async function listContractInvoices(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const contractId = String(req.params.contractId ?? '').trim();
  if (!contractId) {
    res.status(400).json({ error: 'Invalid contractId' });
    return;
  }
  try {
    const contract = await getContractById(contractId, ctx.session.branchId);
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    const rows = await listInvoicesByContract(contractId, ctx.session.branchId);
    res.json({ invoices: rows.map(rowToInvoice) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load invoices' });
  }
}

export async function getInvoice(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const row = await getInvoiceById(id, ctx.session.branchId);
    if (row) {
      res.json({ invoice: rowToInvoice(row) });
      return;
    }

    // Backward compatibility:
    // some clients still pass contractId to /api/invoices/:id for preview links.
    const contract = await getContractById(id, ctx.session.branchId);
    if (!contract) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const rows = await listInvoicesByContract(id, ctx.session.branchId);
    const fallback =
      rows.find((r) => String(r.status ?? '').toLowerCase() === 'issued') ??
      rows.find((r) => String(r.status ?? '').toLowerCase() === 'draft') ??
      rows[0];
    if (!fallback) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    res.json({ invoice: rowToInvoice(fallback) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load invoice' });
  }
}

export async function createContractInvoice(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to create invoices' });
    return;
  }
  const contractId = String(req.params.contractId ?? '').trim();
  if (!contractId) {
    res.status(400).json({ error: 'Invalid contractId' });
    return;
  }
  const parsed = validateCreate(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid invoice payload' });
    return;
  }
  try {
    const contract = await getContractById(contractId, ctx.session.branchId);
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    const invoiceNo = makeInvoiceNo(contractId);
    const issuedAt = parsed.status === 'issued' ? new Date() : null;
    const id = await insertInvoice(ctx.session.branchId, {
      invoiceNo,
      contractId,
      billingPeriodStart: parsed.billingPeriodStart,
      billingPeriodEnd: parsed.billingPeriodEnd,
      dueDate: parsed.dueDate,
      baseAmount: parsed.baseAmount,
      otherCharges: parsed.otherCharges,
      discountAmount: parsed.discountAmount,
      totalAmount: parsed.totalAmount,
      status: parsed.status,
      issuedAt,
      createdBy: ctx.session.user.id,
    });
    const row = await getInvoiceById(id, ctx.session.branchId);
    if (!row) {
      res.status(500).json({ error: 'Failed to load created invoice' });
      return;
    }
    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'ledger',
      recordTable: 'invoice',
      recordId: id,
      action: 'create',
      changeSummary: `Created invoice ${invoiceNo} for contract ${contractId} (total=${parsed.totalAmount})`,
    });
    res.status(201).json({ invoice: rowToInvoice(row) });
  } catch (e) {
    console.error(e);
    if (e?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Invoice number already exists. Try again.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create invoice' });
  }
}

export async function patchInvoice(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to update invoices' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const parsed = validatePatch(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid invoice patch payload' });
    return;
  }
  try {
    const issuedAt = parsed.status === 'issued' ? new Date() : null;
    const affected = await updateInvoiceStatusById(id, ctx.session.branchId, {
      status: parsed.status,
      issuedAt,
    });
    if (affected === 0) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    const row = await getInvoiceById(id, ctx.session.branchId);
    if (!row) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    void logAudit({
      branchId: ctx.session.branchId,
      actorUserId: ctx.session.user.id,
      moduleName: 'ledger',
      recordTable: 'invoice',
      recordId: Number(id),
      action: 'status_change',
      changeSummary: `Invoice status changed to ${parsed.status}`,
    });
    res.json({ invoice: rowToInvoice(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
}

