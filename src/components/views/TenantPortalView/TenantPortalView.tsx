import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CreditCard,
  FileText,
  Wrench,
  Bell,
  Download,
  AlertCircle,
  Loader2,
  User,
  MessageSquare,
  Upload,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { differenceInDays, format, isValid, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Contract, Payment, Tenant, Unit } from '@/types';
import {
  fetchTenantById,
  fetchTenantPortalDocuments,
  uploadTenantKycDocument,
  type PortalDocumentItem,
} from '@/lib/tenantsApi';
import { apiFetch, getAuthHeaders } from '@/lib/api';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchUnits } from '@/lib/unitsApi';
import { fetchPayments, updatePayment } from '@/lib/paymentsApi';
import { createContractSpecialRequest, fetchContractSpecialRequests } from '@/lib/specialRequestsApi';
import { Textarea } from '@/components/ui/textarea';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { Modal } from '@/components/modal';

function isPaidPayment(p: Pick<Payment, 'status'>): boolean {
  return String(p.status ?? '').toLowerCase() === 'paid';
}

function readTenantIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('tenantId')?.trim() || null;
}

function readTenantIdFromStorage(): string | null {
  try {
    return localStorage.getItem('realstate_portal_tenant_id')?.trim() || null;
  } catch {
    return null;
  }
}

function isDatabaseId(value: string | null | undefined): boolean {
  return /^\d+$/.test(String(value ?? '').trim());
}

function toAbsoluteAssetUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return pathOrUrl.startsWith('/') ? `${window.location.origin}${pathOrUrl}` : `${window.location.origin}/${pathOrUrl}`;
}

async function tryParseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function readApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string' &&
    payload.error.trim()
  ) {
    return payload.error;
  }
  return fallback;
}

async function saveResponseAsFile(res: Response, fileName: string) {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function TenantPortalView() {
  const { t } = useTranslation();
  const [tenantIdParam] = useState(readTenantIdFromUrl);
  const tenantId = useMemo(() => tenantIdParam || readTenantIdFromStorage(), [tenantIdParam]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [contractsList, setContractsList] = useState<Contract[]>([]);
  const [unitsList, setUnitsList] = useState<Unit[]>([]);
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [portalDocuments, setPortalDocuments] = useState<PortalDocumentItem[] | null>(null);
  const [portalDocumentsLoading, setPortalDocumentsLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceTitle, setMaintenanceTitle] = useState('');
  const [maintenanceDetails, setMaintenanceDetails] = useState('');
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requests, setRequests] = useState<Array<{ id: string; title: string; details: string; status: string; createdAt: string }>>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; title: string; message: string; time: string; unread: boolean; type?: string }>
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [kycDocUrl, setKycDocUrl] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [supportContactOpen, setSupportContactOpen] = useState(false);

  const supportInboxEmail =
    String(import.meta.env.VITE_TENANT_PORTAL_SUPPORT_EMAIL ?? '').trim() || 'support@realstate.app';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (tenantId) {
        try {
          const [tdata, cdata, udata, pdata] = await Promise.all([
            fetchTenantById(tenantId),
            fetchContracts(),
            fetchUnits(),
            fetchPayments(),
          ]);
          if (cancelled) return;
          setTenant(tdata);
          setContractsList(cdata);
          setUnitsList(udata);
          setPaymentsList(pdata);
          setBootError(null);
          try {
            localStorage.setItem('realstate_portal_tenant_id', String(tdata.id));
          } catch {
            // ignore
          }
        } catch (e) {
          if (cancelled) return;
          setBootError(e instanceof Error ? e.message : t('views.portal.loadError'));
          setTenant(null);
        }
      } else {
        if (cancelled) return;
        setTenant(null);
        setContractsList([]);
        setUnitsList([]);
        setPaymentsList([]);
        setBootError('Select a tenant from CRM and open the portal again.');
      }
      if (!cancelled) setPageLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, t]);

  useEffect(() => {
    setKycDocUrl(tenant?.idImageUrl);
  }, [tenant?.idImageUrl]);

  useEffect(() => {
    if (!tenant?.id) return;
    if (!isDatabaseId(tenant.id)) {
      setPortalDocuments([]);
      setPortalDocumentsLoading(false);
      return;
    }
    let cancelled = false;
    setPortalDocumentsLoading(true);
    void (async () => {
      try {
        const docs = await fetchTenantPortalDocuments(tenant.id);
        if (!cancelled) {
          setPortalDocuments(docs);
        }
      } catch {
        if (!cancelled) {
          setPortalDocuments(null);
          toast.error(t('views.portal.documentsLoadError'));
        }
      } finally {
        if (!cancelled) setPortalDocumentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant?.id, t]);

  const contract = useMemo(() => {
    if (!tenant) return undefined;
    const forTenant = contractsList.filter((c) => c.tenantId === tenant.id);
    return (
      forTenant.find((c) => String(c.status).toLowerCase() === 'active') ?? forTenant[0]
    );
  }, [contractsList, tenant]);

  const unit = useMemo(
    () => (contract ? unitsList.find((u) => u.id === contract.unitId) : undefined),
    [unitsList, contract],
  );

  const tenantPayments = useMemo(
    () => (contract ? paymentsList.filter((p) => p.contractId === contract.id) : []),
    [paymentsList, contract],
  );

  const currentBalance = useMemo(() => {
    return tenantPayments
      .filter((p) => String(p.status ?? '').toLowerCase() !== 'paid')
      .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  }, [tenantPayments]);

  const verificationProgress = useMemo(() => {
    if (!tenant) return 0;
    return tenant.kycVerified ? 100 : 0;
  }, [tenant]);

  const nextDue = useMemo(() => {
    const rows = tenantPayments
      .map((p) => ({ p, due: p.dueDate ? parseISO(p.dueDate) : null }))
      .filter((x) => x.due && isValid(x.due as Date));
    rows.sort((a, b) => (a.due as Date).getTime() - (b.due as Date).getTime());
    const today = new Date();
    const upcoming = rows.find((x) => (x.due as Date).getTime() >= today.getTime());
    return upcoming ?? rows[rows.length - 1] ?? null;
  }, [tenantPayments]);

  const statusLabel = useMemo(() => {
    if (!contract) return t('views.portal.currentStatus');
    const overdue = tenantPayments.some(
      (p) => String(p.status ?? '').toLowerCase() === 'overdue' || (!p.paidDate && p.dueDate && parseISO(p.dueDate) < new Date()),
    );
    if (overdue) return 'Overdue';
    return t('views.portal.paidActive');
  }, [contract, tenantPayments, t]);

  useEffect(() => {
    let cancelled = false;
    setNotificationsLoading(true);
    void (async () => {
      try {
        const res = await apiFetch<{
          notifications: Array<{ id: string; title: string; message: string; time: string; type: string; unread: boolean }>;
        }>('/api/notifications?limit=10');
        if (!cancelled) setNotifications(Array.isArray(res.notifications) ? res.notifications : []);
      } catch {
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setNotificationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!contract?.id) {
      setRequests([]);
      return;
    }
    if (!isDatabaseId(contract.id)) {
      setRequests([]);
      setRequestsLoading(false);
      return;
    }
    let cancelled = false;
    setRequestsLoading(true);
    void (async () => {
      try {
        const rows = await fetchContractSpecialRequests(contract.id);
        if (!cancelled) setRequests(rows);
      } catch {
        if (!cancelled) setRequests([]);
      } finally {
        if (!cancelled) setRequestsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contract?.id]);

  const submitMaintenance = async () => {
    if (!contract?.id) return;
    if (!isDatabaseId(contract.id)) {
      toast.error('Maintenance requests are unavailable in demo mode.');
      return;
    }
    const title = maintenanceTitle.trim();
    const details = maintenanceDetails.trim();
    if (!title || !details) {
      toast.error('Please enter a title and details.');
      return;
    }
    if (maintenanceSaving) return;
    setMaintenanceSaving(true);
    try {
      const next = await createContractSpecialRequest(contract.id, { title, details });
      setRequests(next);
      setMaintenanceTitle('');
      setMaintenanceDetails('');
      setMaintenanceOpen(false);
      toast.success('Maintenance request submitted.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit request');
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const paymentStatusBadge = useCallback((p: Payment) => {
    const s = String(p.status ?? '').toLowerCase();
    if (s === 'paid') return <Badge className="bg-emerald-600 hover:bg-emerald-600">Paid</Badge>;
    if (s === 'overdue') return <Badge className="bg-rose-600 hover:bg-rose-600">Overdue</Badge>;
    if (s === 'pending')
      return <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">Pending</Badge>;
    return <Badge variant="outline">{p.status || '—'}</Badge>;
  }, []);

  const paymentColumns: ColumnDef<Payment>[] = useMemo(
    () => [
      {
        header: t('views.dashboard.payments.dueDate'),
        render: (payment) => {
          if (!payment.dueDate) return <span>—</span>;
          const d = parseISO(payment.dueDate);
          return <span>{isValid(d) ? format(d, 'MMM dd, yyyy') : payment.dueDate}</span>;
        },
      },
      {
        header: t('views.dashboard.payments.amount'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (payment) => (
          <span className="font-semibold">₱{Number(payment.amount ?? 0).toLocaleString()}</span>
        ),
      },
      {
        header: t('views.portal.table.status'),
        render: (payment) => paymentStatusBadge(payment),
      },
    ],
    [t, paymentStatusBadge],
  );

  const handlePreviewContract = () => {
    if (contract) {
      const url = `${window.location.origin}/preview?type=contract&id=${contract.id}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handlePortalDocumentActivate = async (doc: PortalDocumentItem) => {
    if (!tenant || downloadingId) return;
    if (doc.kind === 'preview') {
      const url = `${window.location.origin}/preview?type=contract&id=${doc.contractId}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setDownloadingId(doc.id);
    try {
      if (doc.kind === 'artifact') {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenant.id)}/portal-artifacts/${encodeURIComponent(doc.slug)}`,
          { headers: getAuthHeaders() },
        );
        if (!res.ok) {
          const err = await tryParseJson(res);
          const msg = readApiErrorMessage(err, res.statusText || `HTTP ${res.status}`);
          throw new Error(msg || `HTTP ${res.status}`);
        }
        await saveResponseAsFile(res, doc.fileName);
        toast.success(t('views.portal.documentDownloaded'));
        return;
      }
      const href = toAbsoluteAssetUrl(doc.downloadPath);
      const res = await fetch(href);
      if (!res.ok) throw new Error(res.statusText || `HTTP ${res.status}`);
      await saveResponseAsFile(res, doc.fileName);
      toast.success(t('views.portal.documentDownloaded'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.portal.documentDownloadError'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePickDocument = () => {
    fileRef.current?.click();
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !tenant) return;
    if (!isDatabaseId(tenant.id)) {
      toast.error('KYC upload is unavailable in demo mode.');
      return;
    }
    setUploading(true);
    try {
      const updated = await uploadTenantKycDocument(tenant.id, file);
      setTenant(updated);
      setKycDocUrl(updated.idImageUrl);
      toast.success('ID document uploaded.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handlePayNow = async () => {
    if (!contract?.id) {
      toast.message('No contract linked to this portal.');
      return;
    }
    if (!isDatabaseId(contract.id)) {
      toast.message('Pay Now is not available in demo mode.');
      return;
    }
    const unpaid = tenantPayments.filter((p) => !isPaidPayment(p));
    if (unpaid.length === 0) {
      toast.success('You have no outstanding payments.');
      return;
    }
    unpaid.sort((a, b) => String(a.dueDate ?? '').localeCompare(String(b.dueDate ?? '')));
    const pick = unpaid[0];
    const dueSlice = String(pick.dueDate ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueSlice)) {
      toast.error('This payment row has an invalid due date. Update it in Lease Ledger.');
      return;
    }
    if (paySubmitting) return;
    setPaySubmitting(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      await updatePayment(pick.id, {
        contractId: pick.contractId,
        unitId: pick.unitId,
        amount: Number(pick.amount),
        dueDate: dueSlice,
        paidDate: today,
        status: 'Paid',
      });
      const refreshed = await fetchPayments();
      setPaymentsList(refreshed);
      toast.success(t('views.ledger.markedPaid'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('views.ledger.saveError'));
    } finally {
      setPaySubmitting(false);
    }
  };

  const scrollToPayments = useCallback(() => {
    document.getElementById('payments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToMaintenance = useCallback(() => {
    document.getElementById('maintenance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToDocuments = useCallback(() => {
    document.getElementById('documents')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  function handleQuickPayFromHero() {
    scrollToPayments();
    if (currentBalance <= 0 || paySubmitting) return;
    window.setTimeout(() => void handlePayNow(), 420);
  }

  function handleViewDocumentsQuick() {
    scrollToDocuments();
    if (portalDocumentsLoading) return;
    if (portalDocuments !== null && portalDocuments.length === 0) {
      toast.message('No documents yet. Files will appear here when your property office publishes them.');
    }
  }

  function handleContactSupport() {
    setSupportContactOpen(true);
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 dark:text-indigo-400" aria-hidden />
        <p className="text-sm">{t('views.portal.loading')}</p>
      </div>
    );
  }

  if (bootError || !tenant) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 px-6 text-center dark:bg-slate-950">
        <AlertCircle className="h-10 w-10 text-rose-500" aria-hidden />
        <p className="text-slate-700 max-w-md dark:text-slate-200">{bootError ?? t('views.portal.loadError')}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            window.location.assign(`${window.location.origin}/crm`);
          }}
        >
          Go to CRM
        </Button>
      </div>
    );
  }

  const leaseStart = contract?.startDate ? parseISO(contract.startDate) : null;
  const leaseEnd = contract?.endDate ? parseISO(contract.endDate) : null;

  const requestStatusBadge = (raw: string) => {
    const s = String(raw ?? '').toLowerCase();
    if (s === 'open' || s === 'pending') {
      return (
        <Badge variant="outline" className="border-amber-200 text-amber-800">
          Pending
        </Badge>
      );
    }
    if (s === 'in_progress' || s === 'in progress') {
      return (
        <Badge variant="outline" className="border-indigo-200 text-indigo-700">
          In Progress
        </Badge>
      );
    }
    if (s === 'resolved' || s === 'completed') {
      return (
        <Badge variant="outline" className="border-emerald-200 text-emerald-700">
          Completed
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-slate-200 text-slate-700">
        {raw || '—'}
      </Badge>
    );
  };

  const leaseStatusPill = (() => {
    const s = String(statusLabel ?? '').toLowerCase();
    const isOverdue = s.includes('overdue');
    if (isOverdue) {
      return <Badge className="bg-rose-600 hover:bg-rose-600">Overdue</Badge>;
    }
    if (currentBalance > 0) {
      return (
        <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">
          Pending
        </Badge>
      );
    }
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Good</Badge>;
  })();

  const contractStatusPill = (() => {
    const s = String(contract?.status ?? '').toLowerCase();
    if (s === 'active') return <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>;
    if (s === 'expired') return <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">Expired</Badge>;
    if (s) return <Badge className="bg-slate-700 hover:bg-slate-700">{contract?.status}</Badge>;
    return <Badge variant="outline">—</Badge>;
  })();

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="relative overflow-hidden bg-gradient-to-br from-violet-800 via-indigo-700 to-indigo-950 text-white shadow-[inset_0_-1px_0_0_rgb(255_255_255/0.08)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_-20%,rgb(196_181_253/0.35),transparent)]" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-0">
            <div className="flex min-w-0 flex-1 items-center gap-4 lg:border-r lg:border-white/[0.18] lg:pr-10">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <User className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0 py-0.5">
                <div className="text-sm font-medium tracking-wide text-white/75">Tenant Portal</div>
                <h1 className="mt-0.5 truncate text-2xl font-bold sm:text-3xl">
                  {t('views.portal.welcome', { name: tenant.name })}
                </h1>
                <div className="mt-1 truncate text-sm text-white/75">
                  Unit {unit?.unitNumber ?? '—'} · {unit?.buildingName ?? '—'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:min-w-[min(100%,20rem)] lg:flex-col lg:justify-center lg:pl-10 xl:min-w-[22rem] xl:flex-row xl:flex-wrap xl:items-center">
              <Button
                className="bg-white text-indigo-700 shadow-sm hover:bg-indigo-50"
                onClick={handleQuickPayFromHero}
              >
                <CreditCard className="mr-2 h-4 w-4" aria-hidden />
                Pay
              </Button>
              <Button
                variant="outline"
                className="border-white/35 bg-white/10 text-white hover:bg-white/15"
                onClick={() => {
                  setMaintenanceOpen(true);
                  scrollToMaintenance();
                }}
              >
                <Wrench className="mr-2 h-4 w-4" aria-hidden />
                Request Maintenance
              </Button>
              <Button
                variant="outline"
                className="border-white/35 bg-white/10 text-white hover:bg-white/15"
                onClick={handleContactSupport}
              >
                <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-950/[0.04] dark:border-slate-800 dark:bg-slate-950 lg:flex-row lg:items-stretch">
          <main className="min-w-0 flex-1 space-y-6 bg-white p-6 sm:p-8 dark:bg-slate-950 lg:shadow-[inset_-8px_0_24px_-20px_rgb(15_23_42/0.06)] dark:lg:shadow-[inset_-8px_0_24px_-20px_rgb(0_0_0/0.35)]">
            <Card className="border border-slate-200/80 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md hover:border-slate-300/80 dark:border-slate-700/90 dark:bg-slate-900/50 dark:hover:border-slate-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-700" aria-hidden />
                Lease Info
              </CardTitle>
              <CardDescription>Unit, rent, contract dates, and status.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:bg-slate-900/70">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Unit</div>
                <div className="mt-1 text-lg font-bold dark:text-slate-100">
                  {unit?.unitNumber ?? '—'} · {unit?.buildingName ?? '—'}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{unit?.commonAddress ?? unit?.legalAddress ?? '—'}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:bg-slate-900/70">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Rent</div>
                <div className="mt-1 text-lg font-bold dark:text-slate-100">₱{Number(contract?.monthlyRent ?? 0).toLocaleString()}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span>
                    {leaseStart && isValid(leaseStart) ? format(leaseStart, 'MMM dd, yyyy') : '—'} →{' '}
                    {leaseEnd && isValid(leaseEnd) ? format(leaseEnd, 'MMM dd, yyyy') : '—'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  {contractStatusPill}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:bg-slate-900/70">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</div>
                  {leaseStatusPill}
                </div>
                <div className="mt-1 text-lg font-bold dark:text-slate-100">{statusLabel}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {nextDue?.due
                    ? `Next payment due in ${Math.max(0, differenceInDays(nextDue.due as Date, new Date()))} days`
                    : 'No upcoming due date found.'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:bg-slate-900/70">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">KYC</div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-lg font-bold dark:text-slate-100">{verificationProgress}%</div>
                  <Badge variant="outline" className="border-indigo-200 text-indigo-700">
                    {tenant.kycVerified ? 'Verified' : 'Pending'}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/webp,image/*,application/pdf"
                    className="hidden"
                    onChange={handleUploadDocument}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handlePickDocument}
                    disabled={uploading}
                  >
                    <Upload className="mr-2 h-4 w-4" aria-hidden />
                    {uploading ? 'Uploading…' : 'Upload ID document'}
                  </Button>
                  {kycDocUrl ? (
                    <a
                      href={toAbsoluteAssetUrl(kycDocUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-700 hover:underline dark:text-indigo-400"
                    >
                      View uploaded file
                    </a>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="payments" className="border border-slate-200/80 shadow-sm scroll-mt-6 transition-all hover:-translate-y-[1px] hover:shadow-md hover:border-slate-300/80 dark:border-slate-700/90 dark:bg-slate-900/50 dark:hover:border-slate-600">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-indigo-700" aria-hidden />
                    Payments
                  </CardTitle>
                  <CardDescription>Current balance + payment history.</CardDescription>
                </div>
                <Button
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() => void handlePayNow()}
                  disabled={paySubmitting || currentBalance <= 0}
                >
                  <CreditCard className="mr-2 h-4 w-4" aria-hidden />
                  {paySubmitting ? 'Processing…' : 'Pay Now'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-500/25 dark:bg-indigo-950/50">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">Current Balance</div>
                  {currentBalance > 0 ? (
                    <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">Due</Badge>
                  ) : (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Paid</Badge>
                  )}
                </div>
                <div className="mt-1 text-2xl font-black text-indigo-900 dark:text-indigo-100">₱{Number(currentBalance).toLocaleString()}</div>
                <div className="mt-1 text-xs text-indigo-700/80 dark:text-indigo-200/80">
                  {currentBalance > 0 ? 'Includes pending/overdue items.' : 'You are all set.'}
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/50">
                <DataTable
                  data={tenantPayments}
                  columns={paymentColumns}
                  keyExtractor={(p) => p.id}
                  embedded
                  highlightFirstColumn={false}
                />
              </div>
            </CardContent>
          </Card>

          <Card id="maintenance" className="border border-slate-200/80 shadow-sm scroll-mt-6 transition-all hover:-translate-y-[1px] hover:shadow-md hover:border-slate-300/80 dark:border-slate-700/90 dark:bg-slate-900/50 dark:hover:border-slate-600">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-indigo-700" aria-hidden />
                    Maintenance
                  </CardTitle>
                  <CardDescription>Requests with status.</CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setMaintenanceOpen((v) => !v)}
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-200 dark:hover:bg-indigo-950/50"
                >
                  <Wrench className="mr-2 h-4 w-4" aria-hidden />
                  {maintenanceOpen ? 'Close Form' : 'Request Maintenance'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {maintenanceOpen ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/80">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <Label>Title</Label>
                      <Input value={maintenanceTitle} onChange={(e) => setMaintenanceTitle(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Details</Label>
                      <Textarea value={maintenanceDetails} onChange={(e) => setMaintenanceDetails(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setMaintenanceOpen(false)} disabled={maintenanceSaving}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="bg-indigo-600 text-white hover:bg-indigo-700"
                        onClick={() => void submitMaintenance()}
                        disabled={maintenanceSaving}
                      >
                        {maintenanceSaving ? 'Submitting…' : 'Submit'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {requestsLoading ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">Loading requests…</div>
              ) : requests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                  No maintenance requests yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {requests.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-slate-600"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate dark:text-slate-100">{r.title}</div>
                          <div className="mt-1 text-sm text-slate-600 line-clamp-2 dark:text-slate-300">{r.details}</div>
                          {r.createdAt ? <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{r.createdAt}</div> : null}
                        </div>
                        <div className="shrink-0">{requestStatusBadge(r.status)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="documents" className="border border-slate-200/80 shadow-sm scroll-mt-6 transition-all hover:-translate-y-[1px] hover:shadow-md hover:border-slate-300/80 dark:border-slate-700/90 dark:bg-slate-900/50 dark:hover:border-slate-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4 text-indigo-700" aria-hidden />
                Documents
              </CardTitle>
              <CardDescription>Contract and receipts.</CardDescription>
            </CardHeader>
            <CardContent>
              {portalDocumentsLoading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden />
                  Loading documents…
                </div>
              ) : portalDocuments && portalDocuments.length > 0 ? (
                <div className="space-y-2">
                  {portalDocuments.map((doc) => {
                    const busy = downloadingId === doc.id;
                    const sizeLabel =
                      doc.sizeLabel ?? (doc.kind === 'preview' ? t('views.portal.documentOpenPreview') : '—');
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition-all hover:border-slate-300 hover:bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-slate-600 dark:hover:bg-slate-900/50"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          onClick={() => void handlePortalDocumentActivate(doc)}
                          disabled={Boolean(downloadingId)}
                        >
                          <FileText className="h-4 w-4 text-slate-400" aria-hidden />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{doc.title}</div>
                            <div className="truncate text-[11px] text-slate-500">
                              {doc.fileName}
                              {sizeLabel && sizeLabel !== '—' ? ` · ${sizeLabel}` : ''}
                            </div>
                          </div>
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handlePortalDocumentActivate(doc)}
                          disabled={Boolean(downloadingId)}
                        >
                          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-2 h-4 w-4" aria-hidden />}
                          Download
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                  No documents available yet.
                  {contract ? (
                    <div className="mt-3">
                      <Button type="button" variant="outline" onClick={handlePreviewContract}>
                        Open contract preview
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
          </main>

          {/* Two-way boundary: neutral rail with inner spine + paired borders (primary | rail | secondary) */}
          <div
            className="hidden shrink-0 lg:flex lg:w-[13px] lg:flex-col lg:justify-stretch lg:bg-gradient-to-b lg:from-slate-100/80 lg:via-slate-200/60 lg:to-slate-100/80 lg:border-x lg:border-slate-300/80 dark:lg:from-slate-900/95 dark:lg:via-slate-800/90 dark:lg:to-slate-900/95 dark:lg:border-slate-700/60"
            aria-hidden
          >
            <div className="mx-auto my-10 w-px flex-1 rounded-full bg-gradient-to-b from-indigo-400/50 via-slate-500/70 to-violet-400/50 shadow-[0_0_0_1px_rgb(255_255_255/0.65)] dark:from-indigo-500/35 dark:via-slate-500/50 dark:to-violet-500/35 dark:shadow-[0_0_0_1px_rgb(255_255_255/0.08)]" />
          </div>

          <aside className="min-w-0 space-y-6 border-t border-slate-200/90 bg-gradient-to-b from-slate-50/95 via-slate-50/80 to-slate-100/50 p-6 sm:p-8 lg:w-[min(22rem,100%)] lg:shrink-0 lg:border-t-0 lg:bg-gradient-to-b lg:from-slate-50 lg:to-slate-100/40 lg:shadow-[inset_8px_0_24px_-20px_rgb(15_23_42/0.07)] dark:border-slate-800 dark:from-slate-950 dark:via-slate-900/95 dark:to-slate-950 dark:lg:from-slate-950 dark:lg:to-slate-900/90 dark:lg:shadow-[inset_8px_0_24px_-20px_rgb(0_0_0/0.35)] lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <Card className="border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-[2px] transition-all hover:-translate-y-[1px] hover:shadow-md hover:border-slate-300/80 dark:border-slate-700/90 dark:bg-slate-900/60 dark:hover:border-slate-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-indigo-700 dark:text-indigo-400" aria-hidden />
                Notifications
              </CardTitle>
              <CardDescription className="dark:text-slate-400">Recent updates and reminders.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {notificationsLoading ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>
              ) : notifications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                  No notifications.
                </div>
              ) : (
                notifications.slice(0, 6).map((n) => (
                  <div
                    key={n.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3 transition-all hover:border-slate-300 hover:bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/70 dark:hover:border-slate-600 dark:hover:bg-slate-900/80"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold dark:text-slate-100">{n.title}</div>
                        <div className="mt-0.5 text-xs text-slate-600 line-clamp-2 dark:text-slate-300">{n.message}</div>
                        <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{n.time}</div>
                      </div>
                      {n.unread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400" /> : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
            </Card>

            <Card className="border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-[2px] transition-all hover:-translate-y-[1px] hover:shadow-md hover:border-slate-300/80 dark:border-slate-700/90 dark:bg-slate-900/60 dark:hover:border-slate-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription className="dark:text-slate-400">Pay, request maintenance, contact support.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full justify-start bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={() => {
                  scrollToPayments();
                  window.setTimeout(() => void handlePayNow(), 320);
                }}
                disabled={paySubmitting || currentBalance <= 0}
                title={currentBalance <= 0 ? 'No balance due' : 'Pay the oldest unpaid installment'}
              >
                <CreditCard className="mr-2 h-4 w-4" aria-hidden />
                {paySubmitting ? 'Processing…' : 'Pay Now'}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-200 dark:hover:bg-indigo-950/50"
                onClick={() => {
                  setMaintenanceOpen(true);
                  scrollToMaintenance();
                }}
              >
                <Wrench className="mr-2 h-4 w-4" aria-hidden />
                Request Maintenance
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={handleViewDocumentsQuick}
              >
                <FileText className="mr-2 h-4 w-4" aria-hidden />
                View Documents
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={handleContactSupport}
              >
                <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
                Contact Support
              </Button>
            </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <Modal
        isOpen={supportContactOpen}
        onClose={() => setSupportContactOpen(false)}
        title="Contact support"
        subtitle="Reach your property office or send a message to the team."
        maxWidth="md"
        variant="glass"
      >
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
          <p>
            Billing and lease questions:{' '}
            <a
              className="font-semibold text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
              href={`mailto:${supportInboxEmail}?subject=${encodeURIComponent('Tenant portal — inquiry')}`}
            >
              {supportInboxEmail}
            </a>
          </p>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-950/80">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              On file for your account
            </div>
            <dl className="mt-3 space-y-2 text-slate-800 dark:text-slate-100">
              {tenant.email ? (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                  <dt className="shrink-0 text-xs text-slate-500 dark:text-slate-400">Email</dt>
                  <dd className="min-w-0">
                    <a href={`mailto:${tenant.email}`} className="break-all text-indigo-700 hover:underline dark:text-indigo-400">
                      {tenant.email}
                    </a>
                  </dd>
                </div>
              ) : null}
              {tenant.phone ? (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                  <dt className="shrink-0 text-xs text-slate-500 dark:text-slate-400">Phone</dt>
                  <dd>
                    <a
                      href={`tel:${String(tenant.phone).replace(/[^\d+]/g, '')}`}
                      className="text-indigo-700 hover:underline dark:text-indigo-400"
                    >
                      {tenant.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {!tenant.email && !tenant.phone ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">No email or phone on file.</p>
              ) : null}
            </dl>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => {
                void navigator.clipboard.writeText(supportInboxEmail).then(
                  () => toast.success('Support email copied.'),
                  () => toast.error('Could not copy.'),
                );
              }}
            >
              Copy support email
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={() => {
                window.location.href = `mailto:${supportInboxEmail}?subject=${encodeURIComponent('Tenant portal — inquiry')}`;
              }}
            >
              Open in email app
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
