import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { format, isValid, parseISO } from 'date-fns';
import {
  CalendarRange,
  Download,
  Eye,
  FileImage,
  FileText,
  Globe,
  Home,
  Mail,
  Phone,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type TenantDetailsDocument = {
  id: string;
  name: string;
  fileType: string; // e.g. PDF, WEBP
  sizeLabel?: string; // e.g. 1.2 MB
  href?: string;
  onDownload?: () => void;
  onPreview?: () => void;
  kind?: 'pdf' | 'image' | 'other';
};

export type TenantDetailsLease = {
  unitLabel?: string;
  leaseStart?: string; // ISO date
  leaseEnd?: string; // ISO date
  monthlyRent?: number;
  statusLabel?: string; // e.g. Active
};

export type TenantDetailsTenant = {
  name: string;
  email?: string;
  phone?: string;
  nationality?: string;
  verified?: boolean;
  active?: boolean;
  idType?: string;
  idNumber?: string;
  idExpiry?: string; // ISO date or raw
};

export type TenantDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tenant: TenantDetailsTenant | null;
  lease?: TenantDetailsLease;
  documents?: TenantDetailsDocument[];
  onEditTenant?: () => void;
  editLabel?: string;
  closeLabel?: string;
};

function initialFromName(name: string) {
  const n = String(name || '').trim();
  return n ? n.slice(0, 1).toUpperCase() : '?';
}

function formatPhp(amount: number | undefined) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₱0';
  return `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function formatDateRange(startIso?: string, endIso?: string) {
  if (!startIso || !endIso) return '—';
  const s = parseISO(startIso);
  const e = parseISO(endIso);
  if (!isValid(s) || !isValid(e)) return '—';
  return `${format(s, 'MMM d, yyyy')} – ${format(e, 'MMM d, yyyy')}`;
}

function safeFormatDate(value?: string) {
  const v = String(value ?? '').trim();
  if (!v) return '—';
  const d = parseISO(v);
  if (isValid(d)) return format(d, 'MMM d, yyyy');
  return v;
}

function docIcon(kind?: TenantDetailsDocument['kind']) {
  if (kind === 'image') return FileImage;
  if (kind === 'pdf') return FileText;
  return FileText;
}

/** Contract / lease status (Active, Expired, …) — matches contract detail modals. */
function leaseContractStatusPillClass(statusLabel: string): string {
  const s = statusLabel.trim().toLowerCase();
  if (s === 'active') {
    return 'border-emerald-300/80 bg-emerald-100 text-emerald-800 shadow-none hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/25';
  }
  if (s === 'expired') {
    return 'border-rose-300/80 bg-rose-100 text-rose-800 shadow-none hover:bg-rose-100 dark:border-rose-500/45 dark:bg-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/25';
  }
  if (s === 'terminated') {
    return 'border-slate-300/80 bg-slate-100 text-slate-700 shadow-none hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800/80';
  }
  return 'border-slate-200/90 bg-slate-50 text-slate-800 shadow-none dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100';
}

export function TenantDetailsModal({
  isOpen,
  onClose,
  tenant,
  lease,
  documents = [],
  onEditTenant,
  editLabel = 'Edit Tenant',
  closeLabel = 'Close',
}: TenantDetailsModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const headerSub = useMemo(() => {
    const unit = lease?.unitLabel?.trim();
    const rent = lease?.monthlyRent;
    if (!unit && !Number.isFinite(Number(rent))) return null;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
        {unit ? (
          <span className="inline-flex items-center gap-2">
            <Home className="h-4 w-4 text-slate-400 dark:text-slate-400" aria-hidden />
            <span className="font-medium text-slate-800 dark:text-slate-100">{unit}</span>
          </span>
        ) : null}
        {Number.isFinite(Number(rent)) ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded-md bg-purple-100 ring-1 ring-purple-200 dark:bg-purple-950/50 dark:ring-purple-900/60" />
            <span>
              <span className="font-semibold text-slate-900 dark:text-slate-50">{formatPhp(rent)}</span>
              <span className="text-slate-500 dark:text-slate-400"> / month</span>
            </span>
          </span>
        ) : null}
      </div>
    );
  }, [lease?.monthlyRent, lease?.unitLabel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              role="dialog"
              aria-modal="true"
              className={cn(
                'pointer-events-auto w-full max-w-4xl max-h-[90vh] overflow-hidden',
                'rounded-3xl bg-white text-slate-900 shadow-[0_30px_80px_-24px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04]',
                'dark:bg-slate-900 dark:text-slate-50 dark:ring-white/10',
              )}
            >
              {/* Header */}
              <div className="px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <Avatar size="lg" className="ring-2 ring-purple-100 dark:ring-purple-900/40">
                      <AvatarFallback className="bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-200 font-semibold">
                        {initialFromName(tenant?.name ?? '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 truncate">
                          {tenant?.name || 'Tenant'}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {tenant?.verified ? (
                            <Badge
                              variant="outline"
                              className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"
                            >
                              {t('views.crm.tenantModal.kycVerified')}
                            </Badge>
                          ) : null}
                          {tenant?.active === false ? (
                            <Badge
                              variant="outline"
                              className="border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-200"
                            >
                              {t('views.crm.table.blacklisted')}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {headerSub}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="rounded-xl h-9 w-9 text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50"
                    onClick={onClose}
                    title="Close"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 pb-6 overflow-y-auto custom-scrollbar max-h-[calc(90vh-96px-76px)]">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Tenant Information */}
                  <div className="rounded-2xl bg-slate-50/70 ring-1 ring-slate-200/70 p-5 dark:bg-slate-800/50 dark:ring-slate-700/70">
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Tenant Information</div>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-700/70">
                          <Mail className="h-4 w-4 text-slate-500 dark:text-slate-300" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</div>
                          <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-50 break-all">
                            {tenant?.email || '—'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-700/70">
                          <Phone className="h-4 w-4 text-slate-500 dark:text-slate-300" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phone</div>
                          <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-50">
                            {tenant?.phone || '—'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-700/70">
                          <Globe className="h-4 w-4 text-slate-500 dark:text-slate-300" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nationality</div>
                          <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-50">
                            {tenant?.nationality || '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lease Information */}
                  <div className="rounded-2xl bg-slate-50/70 ring-1 ring-slate-200/70 p-5 dark:bg-slate-800/50 dark:ring-slate-700/70">
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Lease Information</div>
                    <div className="mt-4 grid grid-cols-1 gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Unit</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50 text-right">
                          {lease?.unitLabel || '—'}
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lease Period</div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-50 text-right inline-flex items-center gap-2">
                          <CalendarRange className="h-4 w-4 text-slate-400" aria-hidden />
                          <span>{formatDateRange(lease?.leaseStart, lease?.leaseEnd)}</span>
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Monthly Rent</div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
                            {formatPhp(lease?.monthlyRent)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {t('views.crm.details.leaseContractStatus')}
                        </div>
                        <div>
                          {lease?.statusLabel ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'h-auto rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide',
                                leaseContractStatusPillClass(lease.statusLabel),
                              )}
                            >
                              {lease.statusLabel}
                            </Badge>
                          ) : (
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Identification */}
                <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200/70 p-5 shadow-sm dark:bg-slate-900 dark:ring-slate-700/70">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Identification</div>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50/70 ring-1 ring-slate-200/70 p-4 dark:bg-slate-800/50 dark:ring-slate-700/70">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">ID Type</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{tenant?.idType || '—'}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50/70 ring-1 ring-slate-200/70 p-4 dark:bg-slate-800/50 dark:ring-slate-700/70">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">ID Number</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{tenant?.idNumber || '—'}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50/70 ring-1 ring-slate-200/70 p-4 dark:bg-slate-800/50 dark:ring-slate-700/70">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">ID Expiry</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {safeFormatDate(tenant?.idExpiry)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200/70 p-5 shadow-sm dark:bg-slate-900 dark:ring-slate-700/70">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Documents</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Contracts, IDs, and supporting files.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {documents.length === 0 ? (
                      <div className="rounded-2xl bg-slate-50/70 ring-1 ring-slate-200/70 p-4 text-sm text-slate-500 dark:bg-slate-800/50 dark:ring-slate-700/70 dark:text-slate-400">
                        No documents available.
                      </div>
                    ) : (
                      documents.map((d) => {
                        const Icon = docIcon(d.kind);
                        return (
                          <div
                            key={d.id}
                            className={cn(
                              'group flex items-center justify-between gap-3 rounded-2xl px-4 py-3 transition-all',
                              'bg-slate-50/70 ring-1 ring-slate-200/70 hover:bg-white hover:shadow-sm',
                              'dark:bg-slate-800/50 dark:ring-slate-700/70 dark:hover:bg-slate-800/70',
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-700/70">
                                <Icon className="h-5 w-5 text-purple-600 dark:text-purple-300" aria-hidden />
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 dark:text-slate-50 truncate">{d.name}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  <Badge
                                    variant="outline"
                                    className="border-0 bg-slate-200/70 text-slate-700 dark:bg-slate-700/70 dark:text-slate-200"
                                  >
                                    {d.fileType.toUpperCase()}
                                  </Badge>
                                  <span>{d.sizeLabel || '—'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => {
                                  if (d.onDownload) d.onDownload();
                                  else if (d.href) window.open(d.href, '_blank', 'noopener,noreferrer');
                                }}
                                disabled={!d.onDownload && !d.href}
                              >
                                <Download className="h-4 w-4 mr-1.5" aria-hidden />
                                Download
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400"
                                title="Preview"
                                onClick={() => {
                                  if (d.onPreview) d.onPreview();
                                  else if (d.href) window.open(d.href, '_blank', 'noopener,noreferrer');
                                }}
                                disabled={!d.onPreview && !d.href}
                              >
                                <Eye className="h-4 w-4" aria-hidden />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-5 bg-white/70 ring-1 ring-slate-200/70 border-t border-slate-100 dark:bg-slate-900/60 dark:ring-slate-700/70 dark:border-slate-800">
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>
                    {closeLabel}
                  </Button>
                  <Button
                    type="button"
                    className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                    onClick={onEditTenant}
                    disabled={!onEditTenant}
                  >
                    {editLabel}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

