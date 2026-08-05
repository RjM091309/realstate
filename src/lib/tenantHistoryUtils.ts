import { format, isValid, parseISO } from 'date-fns';
import type { AuditLog } from '@/lib/auditLogsApi';
import type { SpecialRequestRow } from '@/lib/specialRequestsApi';
import type { Contract, InvoiceRow, Payment, Tenant, UnitInspectionPayload } from '@/types';

export type HistoryTab = 'overview' | 'activity';

export type TimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  pinned?: boolean;
};

export type FinancialSummary = {
  reliabilityLabel: string;
  reliabilityTone: 'success' | 'warning' | 'danger' | 'neutral';
  onTimePercent: number | null;
  outstandingBalance: number;
};

export type LedgerRow = {
  id: string;
  invoiceNo: string;
  billingPeriod: string;
  amount: number;
  paymentDate?: string;
  status: 'Paid' | 'Overdue' | 'Pending' | 'Partial';
};

export type LogisticsNote = {
  id: string;
  at?: string;
  category: 'admin' | 'maintenance' | 'incident' | 'lease';
  title: string;
  body?: string;
  status?: string;
};

export function parseHistoryDateTime(value?: string): Date | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().includes('T') ? value.trim() : value.trim().replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatHistoryDateTime(value?: string): string {
  const dt = parseHistoryDateTime(value);
  return dt ? format(dt, 'MMM dd, yyyy · h:mm a') : '—';
}

export function formatHistoryDate(value?: string): string {
  if (!value?.trim()) return '—';
  const d = parseISO(value.trim().slice(0, 10));
  return isValid(d) ? format(d, 'MMM dd, yyyy') : value;
}

export function formatHistoryPhp(amount: number | undefined): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₱0';
  return `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export function formatBillingPeriod(start?: string, end?: string): string {
  if (!start || !end) return '—';
  return `${formatHistoryDate(start)} – ${formatHistoryDate(end)}`;
}

export function pickCurrentLease(contracts: Contract[]): Contract | null {
  if (!contracts.length) return null;
  const active = contracts.find((c) => c.status === 'Active');
  if (active) return active;
  const pending = contracts.find((c) => c.status === 'Pending Inspection');
  if (pending) return pending;
  return [...contracts].sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
}

function historyActionTitle(action: string, t: (key: string) => string): string {
  const key = `views.crm.history.actions.${action}`;
  const translated = t(key);
  return translated === key ? action : translated;
}

export function buildTimelineEvents(params: {
  tenant: Tenant;
  profileLogs: AuditLog[];
  contractLogs: AuditLog[];
  contracts: Contract[];
  inspection: UnitInspectionPayload | null;
  t: (key: string, opts?: Record<string, string>) => string;
}): TimelineEvent[] {
  const { tenant, profileLogs, contractLogs, contracts, inspection, t } = params;
  const events: TimelineEvent[] = [];

  for (const log of contractLogs) {
    events.push({
      id: `contract-log-${log.id}`,
      at: log.createdAt,
      title: historyActionTitle(log.action, t),
      detail: log.changeSummary || undefined,
    });
  }

  for (const log of profileLogs) {
    if (log.action === 'create') continue;
    events.push({
      id: `profile-log-${log.id}`,
      at: log.createdAt,
      title: historyActionTitle(log.action, t),
      detail: log.changeSummary || undefined,
    });
  }

  if (inspection?.inspection) {
    const ins = inspection.inspection;
    if (ins.approvedAt) {
      events.push({
        id: `inspection-approved-${ins.id}`,
        at: ins.approvedAt,
        title: t('views.crm.history.events.inspectionApproved'),
        detail: ins.inspectorRemarks || undefined,
      });
    }
    if (ins.startedAt) {
      events.push({
        id: `inspection-started-${ins.id}`,
        at: ins.startedAt,
        title: t('views.crm.history.events.inspectionStarted'),
      });
    }
    for (const log of inspection.logs ?? []) {
      events.push({
        id: `inspection-log-${log.id}`,
        at: log.createdAt,
        title: log.message || t('views.crm.history.events.inspectionUpdate'),
        detail: log.eventType || undefined,
      });
    }
  }

  for (const contract of contracts) {
    if (contract.status === 'Active' && contract.createdAt) {
      events.push({
        id: `contract-active-${contract.id}`,
        at: contract.createdAt,
        title: t('views.crm.history.events.leaseActivated'),
        detail: contract.contractNo
          ? t('views.crm.history.events.leaseRef', { ref: contract.contractNo })
          : undefined,
      });
    }
  }

  const hasCreateAudit = profileLogs.some((log) => log.action === 'create');
  const registrationAt = tenant.createdAt;
  if (registrationAt) {
    events.push({
      id: 'tenant-registered',
      at: registrationAt,
      title: t('views.crm.history.events.profileCreated'),
      detail: hasCreateAudit
        ? profileLogs.find((log) => log.action === 'create')?.changeSummary
        : t('views.crm.history.registered'),
      pinned: true,
    });
  }

  const sortable = events.filter((e) => !e.pinned);
  sortable.sort((a, b) => {
    const da = parseHistoryDateTime(a.at)?.getTime() ?? 0;
    const db = parseHistoryDateTime(b.at)?.getTime() ?? 0;
    return db - da;
  });

  const pinned = events.filter((e) => e.pinned);
  return [...sortable, ...pinned];
}

export function mapInvoiceDisplayStatus(status: InvoiceRow['status']): LedgerRow['status'] {
  if (status === 'paid') return 'Paid';
  if (status === 'overdue') return 'Overdue';
  if (status === 'partially_paid') return 'Partial';
  return 'Pending';
}

export function buildLedgerRows(invoices: InvoiceRow[], payments: Payment[]): LedgerRow[] {
  const paymentByContract = new Map<string, Payment[]>();
  for (const p of payments) {
    const list = paymentByContract.get(p.contractId) ?? [];
    list.push(p);
    paymentByContract.set(p.contractId, list);
  }

  return invoices
    .map((inv) => {
      const related = (paymentByContract.get(inv.contractId) ?? []).filter(
        (p) => p.status === 'Paid' && p.paidDate,
      );
      related.sort((a, b) => (b.paidDate ?? '').localeCompare(a.paidDate ?? ''));
      return {
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        billingPeriod: formatBillingPeriod(inv.billingPeriodStart, inv.billingPeriodEnd),
        amount: inv.totalAmount,
        paymentDate: related[0]?.paidDate ?? (inv.status === 'paid' ? inv.issuedAt : undefined),
        status: mapInvoiceDisplayStatus(inv.status),
      };
    })
    .sort((a, b) => b.billingPeriod.localeCompare(a.billingPeriod));
}

function isPaymentPastDue(payment: Payment): boolean {
  if (payment.status === 'Overdue') return true;
  if (payment.status === 'Paid') return false;
  const due = String(payment.dueDate ?? '').slice(0, 10);
  if (!due) return false;
  const today = new Date().toISOString().slice(0, 10);
  return due <= today;
}

function isPaymentMatured(payment: Payment): boolean {
  const due = String(payment.dueDate ?? '').slice(0, 10);
  if (!due) return payment.status === 'Paid';
  const today = new Date().toISOString().slice(0, 10);
  return due <= today || payment.status === 'Paid';
}

export function computeFinancialSummary(
  payments: Payment[],
  invoices: InvoiceRow[],
  t: (key: string, opts?: Record<string, string | number>) => string,
): FinancialSummary {
  const matured = payments.filter(isPaymentMatured);
  const paidMatured = matured.filter((p) => p.status === 'Paid');

  let onTimePercent: number | null = null;
  if (matured.length > 0) {
    onTimePercent = Math.round((paidMatured.length / matured.length) * 100);
  } else if (invoices.length > 0) {
    const paidInvoices = invoices.filter((i) => i.status === 'paid').length;
    onTimePercent = Math.round((paidInvoices / invoices.length) * 100);
  }

  const overdueInvoices = invoices
    .filter((i) => i.status === 'overdue' || i.status === 'partially_paid')
    .reduce((sum, i) => sum + i.totalAmount, 0);
  const overduePayments = payments
    .filter(isPaymentPastDue)
    .reduce((sum, p) => sum + p.amount, 0);
  const outstandingBalance = overdueInvoices + overduePayments;

  let reliabilityLabel = t('views.crm.history.financial.noData');
  let reliabilityTone: FinancialSummary['reliabilityTone'] = 'neutral';

  if (onTimePercent != null) {
    if (onTimePercent >= 90) {
      reliabilityLabel = t('views.crm.history.financial.goodStanding', { percent: onTimePercent });
      reliabilityTone = 'success';
    } else if (onTimePercent >= 70) {
      reliabilityLabel = t('views.crm.history.financial.fairStanding', { percent: onTimePercent });
      reliabilityTone = 'warning';
    } else {
      reliabilityLabel = t('views.crm.history.financial.poorStanding', { percent: onTimePercent });
      reliabilityTone = 'danger';
    }
  }

  return { reliabilityLabel, reliabilityTone, onTimePercent, outstandingBalance };
}

export function buildLogisticsNotes(params: {
  tenant: Tenant;
  contracts: Contract[];
  specialRequests: SpecialRequestRow[];
  inspection: UnitInspectionPayload | null;
  profileLogs: AuditLog[];
  t: (key: string, opts?: Record<string, string>) => string;
}): LogisticsNote[] {
  const { tenant, contracts, specialRequests, inspection, profileLogs, t } = params;
  const notes: LogisticsNote[] = [];

  if (tenant.isBlacklisted && tenant.blacklistReason) {
    notes.push({
      id: 'blacklist',
      category: 'incident',
      title: t('views.crm.history.notes.blacklisted'),
      body: tenant.blacklistReason,
    });
  }

  for (const contract of contracts) {
    if (contract.remarks?.trim()) {
      notes.push({
        id: `contract-remarks-${contract.id}`,
        at: contract.createdAt,
        category: 'lease',
        title: t('views.crm.history.notes.leaseRemarks', {
          ref: contract.contractNo ?? contract.id,
        }),
        body: contract.remarks.trim(),
      });
    }
  }

  if (inspection?.inspection?.inspectorRemarks?.trim()) {
    notes.push({
      id: `inspection-remarks-${inspection.inspection.id}`,
      at: inspection.inspection.updatedAt,
      category: 'admin',
      title: t('views.crm.history.notes.inspectionRemarks'),
      body: inspection.inspection.inspectorRemarks.trim(),
    });
  }

  for (const req of specialRequests) {
    notes.push({
      id: `request-${req.id}`,
      at: req.updatedAt || req.createdAt,
      category: 'maintenance',
      title: req.title,
      body: req.details?.trim() || undefined,
      status: req.status,
    });
  }

  for (const log of profileLogs) {
    if (log.action === 'create') continue;
    notes.push({
      id: `audit-${log.id}`,
      at: log.createdAt,
      category: 'admin',
      title: historyActionTitle(log.action, t),
      body: log.changeSummary || undefined,
    });
  }

  return notes.sort((a, b) => {
    const da = parseHistoryDateTime(a.at)?.getTime() ?? 0;
    const db = parseHistoryDateTime(b.at)?.getTime() ?? 0;
    return db - da;
  });
}