import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  User,
  FileText,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Package,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tenants, units, contracts, payments } from '@/lib/mockData';
import { format, isValid, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Contract, Payment, Tenant, Unit } from '@/types';
import {
  fetchTenantById,
  fetchTenantPortalDocuments,
  uploadTenantKycDocument,
  type PortalDocumentItem,
} from '@/lib/tenantsApi';
import { getAuthHeaders } from '@/lib/api';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchUnits } from '@/lib/unitsApi';
import { fetchPayments } from '@/lib/paymentsApi';
import { fetchContractInventorySnapshots, fetchSnapshotItems } from '@/lib/inventoryApi';
import { createContractSpecialRequest, fetchContractSpecialRequests } from '@/lib/specialRequestsApi';
import { Textarea } from '@/components/ui/textarea';
import type { InventorySnapshotItemRow } from '@/types';

function readTenantIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('tenantId')?.trim() || null;
}

function toAbsoluteAssetUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return pathOrUrl.startsWith('/') ? `${window.location.origin}${pathOrUrl}` : `${window.location.origin}/${pathOrUrl}`;
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
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [contractsList, setContractsList] = useState<Contract[]>([]);
  const [unitsList, setUnitsList] = useState<Unit[]>([]);
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [kycDocUrl, setKycDocUrl] = useState<string | undefined>(undefined);
  const [portalDocuments, setPortalDocuments] = useState<PortalDocumentItem[] | null>(null);
  const [portalDocumentsLoading, setPortalDocumentsLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventorySnapshotItemRow[]>([]);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceTitle, setMaintenanceTitle] = useState('');
  const [maintenanceDetails, setMaintenanceDetails] = useState('');
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requests, setRequests] = useState<Array<{ id: string; title: string; details: string; status: string; createdAt: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (tenantIdParam) {
        try {
          const [tdata, cdata, udata, pdata] = await Promise.all([
            fetchTenantById(tenantIdParam),
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
        } catch (e) {
          if (cancelled) return;
          setBootError(e instanceof Error ? e.message : t('views.portal.loadError'));
          setTenant(null);
        }
      } else {
        const t0 = tenants[0];
        if (cancelled) return;
        setTenant(t0 ?? null);
        setContractsList(contracts);
        setUnitsList(units);
        setPaymentsList(payments);
        setBootError(t0 ? null : t('views.portal.loadError'));
      }
      if (!cancelled) setPageLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantIdParam, t]);

  useEffect(() => {
    setKycDocUrl(tenant?.idImageUrl);
  }, [tenant?.idImageUrl]);

  useEffect(() => {
    if (!tenant?.id) return;
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

  useEffect(() => {
    if (!contract?.id) {
      setInventoryItems([]);
      return;
    }
    let cancelled = false;
    setInventoryLoading(true);
    void (async () => {
      try {
        const snaps = await fetchContractInventorySnapshots(contract.id);
        if (cancelled) return;
        const moveIn = snaps
          .filter((s) => s.snapshotType === 'move_in')
          .sort((a, b) => String(b.inspectionDate).localeCompare(String(a.inspectionDate)))[0];
        const pick = moveIn ?? snaps.sort((a, b) => String(b.inspectionDate).localeCompare(String(a.inspectionDate)))[0];
        if (!pick) {
          setInventoryItems([]);
          return;
        }
        const items = await fetchSnapshotItems(pick.id);
        if (!cancelled) setInventoryItems(items);
      } catch {
        if (!cancelled) setInventoryItems([]);
      } finally {
        if (!cancelled) setInventoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contract?.id]);

  useEffect(() => {
    if (!contract?.id) {
      setRequests([]);
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

  const paymentColumns: ColumnDef<Payment>[] = useMemo(
    () => [
      {
        header: t('views.portal.table.date'),
        render: (p) => {
          const raw = p.paidDate || p.dueDate;
          const d = raw ? parseISO(raw) : new Date('');
          return <span>{isValid(d) ? format(d, 'MMM dd, yyyy') : '—'}</span>;
        },
      },
      {
        header: t('views.portal.table.reference'),
        render: (p) => <span className="font-mono text-xs uppercase">{p.id}</span>,
      },
      {
        header: t('views.portal.table.amount'),
        render: (p) => <span className="font-bold">₱{p.amount.toLocaleString()}</span>,
      },
      {
        header: t('views.portal.table.status'),
        render: () => (
          <Badge variant="default" className="bg-emerald-500">
            {t('views.portal.table.paid')}
          </Badge>
        ),
      },
      {
        header: t('views.portal.table.action'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: () => (
          <Button variant="ghost" size="sm">
            <Download className="w-4 h-4" />
          </Button>
        ),
      },
    ],
    [t]
  );

  const handlePreviewContract = () => {
    if (contract) {
      const url = `${window.location.origin}${window.location.pathname}?view=preview&type=contract&id=${contract.id}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handlePortalDocumentActivate = async (doc: PortalDocumentItem) => {
    if (!tenant || downloadingId) return;
    if (doc.kind === 'preview') {
      const url = `${window.location.origin}${window.location.pathname}?view=preview&type=contract&id=${doc.contractId}`;
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
          const err = await res.json().catch(() => ({}));
          const msg = typeof err?.error === 'string' ? err.error : res.statusText;
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
    if (uploading) return;
    fileRef.current?.click();
  };

  const handleUploadDocument: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !tenant) return;

    setUploading(true);
    try {
      const updated = await uploadTenantKycDocument(tenant.id, file);
      setKycDocUrl(updated.idImageUrl);
      toast.success(t('views.portal.uploadSuccess'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('views.portal.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-600">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" aria-hidden />
        <p className="text-sm">{t('views.portal.loading')}</p>
      </div>
    );
  }

  if (bootError || !tenant) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle className="h-10 w-10 text-rose-500" aria-hidden />
        <p className="text-slate-700 max-w-md">{bootError ?? t('views.portal.loadError')}</p>
      </div>
    );
  }

  const leaseEnd = contract?.endDate ? parseISO(contract.endDate) : null;

  return (
    <div className="min-h-screen bg-slate-50 animate-in fade-in duration-500">
      <div className="bg-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{t('views.portal.welcome', { name: tenant.name })}</h1>
              <p className="text-indigo-100">{t('views.portal.unitInfo', { unitNumber: unit?.unitNumber, buildingName: unit?.buildingName })}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button className="bg-white text-indigo-600 hover:bg-indigo-50">
              <MessageSquare className="w-4 h-4 mr-2" />
              {t('views.portal.contactManagement')}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Quick Stats & Actions */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-none shadow-sm bg-emerald-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-600 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {t('views.portal.currentStatus')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-900">{t('views.portal.paidActive')}</div>
                <p className="text-xs text-emerald-600 mt-1">{t('views.portal.nextPaymentDue')}</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-indigo-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-indigo-600 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  {t('views.portal.contractPeriod')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-900">
                  {leaseEnd && isValid(leaseEnd) ? format(leaseEnd, 'MMM yyyy') : '—'}
                </div>
                <p className="text-xs text-indigo-600 mt-1">{t('views.portal.leaseExpires')}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="gap-0 overflow-hidden border-none py-0 shadow-md">
            <CardHeader className="border-b border-slate-100 px-6 pt-6 pb-4">
              <CardTitle>{t('views.portal.recentPayments')}</CardTitle>
              <CardDescription>{t('views.portal.recentPaymentsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                data={tenantPayments}
                columns={paymentColumns}
                keyExtractor={(p) => p.id}
                embedded
                highlightFirstColumn={false}
              />
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle>{t('views.portal.unitInventory')}</CardTitle>
              <CardDescription>{t('views.portal.unitInventoryDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inventoryLoading ? (
                  <div className="col-span-full text-sm text-slate-500">Loading inventory…</div>
                ) : inventoryItems.length === 0 ? (
                  <div className="col-span-full text-sm text-slate-500">No inventory snapshot found for this contract.</div>
                ) : (
                  inventoryItems.map((it) => {
                    const ok = it.conditionState === 'excellent' || it.conditionState === 'good';
                    return (
                      <div key={it.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <Package className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {it.itemName}{it.quantity > 1 ? ` ×${it.quantity}` : ''}
                          </span>
                        </div>
                        <Badge variant={ok ? 'outline' : 'destructive'} className="text-[10px] shrink-0">
                          {ok ? t('views.portal.inventoryStatus.good') : t('views.portal.inventoryStatus.maintenanceNeeded')}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: KYC & Documents */}
        <div className="space-y-8">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                {t('views.portal.kycTitle')}
              </CardTitle>
              <CardDescription>{t('views.portal.kycDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <Upload className="w-6 h-6 text-indigo-600" />
                </div>
                <h4 className="text-sm font-bold">{t('views.portal.passportCard')}</h4>
                <p className="text-xs text-slate-500 mt-1 mb-4">{t('views.portal.passportHint')}</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/webp,image/*,application/pdf"
                  className="hidden"
                  onChange={handleUploadDocument}
                />
                <Button
                  size="sm"
                  className="bg-indigo-600 w-full"
                  onClick={handlePickDocument}
                  disabled={uploading}
                >
                  {uploading ? t('views.portal.uploading') : t('views.portal.updateDocument')}
                </Button>
                {kycDocUrl ? (
                  <a
                    href={toAbsoluteAssetUrl(kycDocUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="block mt-3 text-xs text-indigo-600 hover:underline"
                  >
                    {t('views.portal.viewUploaded')}
                  </a>
                ) : null}
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{t('views.portal.verificationProgress')}</span>
                  <span className="font-bold text-indigo-600">85%</span>
                </div>
                <Progress value={85} className="h-2" />
                <p className="text-[10px] text-slate-400">{t('views.portal.lastUpdated')}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle>{t('views.portal.myDocuments')}</CardTitle>
              <CardDescription>{t('views.portal.myDocumentsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {portalDocumentsLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" aria-hidden />
                  {t('views.portal.documentsLoading')}
                </div>
              ) : portalDocuments && portalDocuments.length > 0 ? (
                portalDocuments.map((doc) => {
                  const sizeLabel =
                    doc.sizeLabel ??
                    (doc.kind === 'preview' ? t('views.portal.documentOpenPreview') : '—');
                  const busy = downloadingId === doc.id;
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-2 p-3 hover:bg-slate-50 rounded-lg transition-colors group"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left rounded-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-indigo-500"
                        onClick={() => void handlePortalDocumentActivate(doc)}
                        disabled={Boolean(downloadingId)}
                      >
                        <FileText
                          className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-indigo-600"
                          aria-hidden
                        />
                        <div className="min-w-0 flex flex-col">
                          <span className="text-sm font-medium truncate">{doc.title}</span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {doc.fileName}
                            {sizeLabel && sizeLabel !== '—' ? ` · ${sizeLabel}` : ''}
                          </span>
                        </div>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-slate-400 hover:text-indigo-600"
                        disabled={Boolean(downloadingId)}
                        aria-label={t('views.portal.downloadDocument')}
                        onClick={() => void handlePortalDocumentActivate(doc)}
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Download className="h-4 w-4" aria-hidden />
                        )}
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-slate-500 py-2">{t('views.portal.documentsEmpty')}</p>
                  {contract ? (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={handlePreviewContract}>
                      {t('views.portal.openLeasePreview')}
                    </Button>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-amber-50 border-amber-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-amber-900 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {t('views.portal.maintenanceTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-amber-700 mb-4">{t('views.portal.maintenanceHint')}</p>
              <Button
                size="sm"
                variant="outline"
                className="w-full border-amber-200 text-amber-900 hover:bg-amber-100"
                onClick={() => setMaintenanceOpen((v) => !v)}
              >
                {t('views.portal.submitRequest')}
              </Button>

              {maintenanceOpen ? (
                <div className="mt-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-amber-900">Title</Label>
                    <Input
                      value={maintenanceTitle}
                      onChange={(e) => setMaintenanceTitle(e.target.value)}
                      placeholder="e.g., Water heater not working"
                      className="bg-white/70"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-amber-900">Details</Label>
                    <Textarea
                      value={maintenanceDetails}
                      onChange={(e) => setMaintenanceDetails(e.target.value)}
                      placeholder="Describe the issue (where/when/how)."
                      className="bg-white/70"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-amber-900 hover:bg-amber-100"
                      onClick={() => setMaintenanceOpen(false)}
                      disabled={maintenanceSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-amber-900 text-amber-50 hover:bg-amber-900/90"
                      onClick={() => void submitMaintenance()}
                      disabled={maintenanceSaving}
                    >
                      {maintenanceSaving ? 'Submitting…' : 'Submit'}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="mt-4">
                {requestsLoading ? (
                  <div className="text-xs text-amber-800/80">Loading requests…</div>
                ) : requests.length === 0 ? (
                  <div className="text-xs text-amber-800/80">No requests yet.</div>
                ) : (
                  <div className="space-y-2">
                    {requests.slice(0, 3).map((r) => (
                      <div key={r.id} className="rounded-lg border border-amber-200 bg-white/70 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-amber-900 truncate">{r.title}</div>
                            <div className="text-[11px] text-amber-900/80 line-clamp-2">{r.details}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-900">
                            {r.status}
                          </Badge>
                        </div>
                        {r.createdAt ? <div className="mt-1 text-[10px] text-amber-900/60">{r.createdAt}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}
