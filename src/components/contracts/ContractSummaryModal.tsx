import type { ReactNode } from 'react';
import { FileText, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { differenceInCalendarMonths, format, parseISO } from 'date-fns';
import { Modal, modalFieldLabelClass } from '@/components/modal';
import { StatusBadge } from '@/components/status-badge';
import { Button, modalActionButtonClass, modalOutlineButtonClass } from '@/components/ui/button';
import { contractStatusVariant } from '@/lib/statusBadge';
import { formatPhp } from '@/lib/leaseRenewalUtils';
import { cn } from '@/lib/utils';
import type { Contract, Unit } from '@/types';

export type ContractSummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | null;
  unit: Unit | null;
  tenantName: string;
  agentName: string;
  onEdit?: (contract: Contract) => void;
  onOpenInspection?: (contract: Contract) => void;
  onPreviewDocument?: (contract: Contract, type: 'contract' | 'invoice') => void;
  canEdit?: boolean;
};

export function leaseTermLabel(
  startDate: string,
  endDate: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  try {
    const months = differenceInCalendarMonths(parseISO(endDate), parseISO(startDate));
    if (months === 12) return t('views.contracts.table.term12');
    if (months === 24) return t('views.contracts.table.term24');
    if (months > 0) return t('views.contracts.table.termMonths', { count: months });
  } catch {
    /* ignore */
  }
  return t('views.contracts.table.termCustom');
}

function statusLabel(status: Contract['status'], t: (key: string) => string): string {
  if (status === 'Active') return t('views.contracts.statuses.active');
  if (status === 'Expired') return t('views.contracts.statuses.expired');
  if (status === 'Terminated') return t('views.contracts.statuses.terminated');
  if (status === 'Pending Inspection') return t('views.contracts.statuses.pendingInspection');
  return status;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className={modalFieldLabelClass}>{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50">{children}</div>
    </div>
  );
}

export function ContractSummaryModal({
  isOpen,
  onClose,
  contract,
  unit,
  tenantName,
  agentName,
  onEdit,
  onOpenInspection,
  onPreviewDocument,
  canEdit = false,
}: ContractSummaryModalProps) {
  const { t } = useTranslation();
  if (!contract) return null;

  const contractNo = contract.contractNo ?? contract.id;
  const term = leaseTermLabel(contract.startDate, contract.endDate, t);
  const unitLabel = unit?.unitNumber ?? contract.unitId;
  const building = unit?.buildingName?.trim() || unit?.area?.trim() || '';
  const created = contract.createdAt
    ? (() => {
        const raw = contract.createdAt.includes('T')
          ? contract.createdAt
          : contract.createdAt.replace(' ', 'T');
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
      })()
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>{t('views.contracts.summary.title', { id: contractNo })}</span>
          <StatusBadge
            tone={contract.status === 'Active' ? 'success' : contractStatusVariant(contract.status)}
            className="normal-case"
          >
            {statusLabel(contract.status, t)}
          </StatusBadge>
        </span>
      }
      subtitle={t('views.contracts.summary.subtitle')}
      maxWidth="2xl"
      variant="glass"
      compact
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {onPreviewDocument ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(modalOutlineButtonClass, 'h-9')}
                  onClick={() => onPreviewDocument(contract, 'contract')}
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  {t('views.contracts.table.contract')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(modalOutlineButtonClass, 'h-9')}
                  onClick={() => onPreviewDocument(contract, 'invoice')}
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  {t('views.contracts.table.invoice')}
                </Button>
              </>
            ) : null}
            {onOpenInspection ? (
              <Button
                type="button"
                variant="outline"
                className={cn(modalOutlineButtonClass, 'h-9')}
                onClick={() => {
                  onClose();
                  onOpenInspection(contract);
                }}
              >
                <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                {t('views.contracts.table.inspect')}
              </Button>
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
            {canEdit && onEdit ? (
              <Button
                type="button"
                className={cn(modalActionButtonClass, 'h-9')}
                onClick={() => {
                  onClose();
                  onEdit(contract);
                }}
              >
                {t('views.contracts.table.edit')}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" className="h-9" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('views.contracts.table.contractId')}>{contractNo}</Field>
          <Field label={t('views.contracts.table.tenant')}>{tenantName || '—'}</Field>
          <Field label={t('views.contracts.table.unit')}>
            <span className="block">{unitLabel}</span>
            {building ? (
              <span className="mt-0.5 block text-xs font-medium normal-case text-slate-500 dark:text-slate-400">
                {building}
              </span>
            ) : null}
          </Field>
          <Field label={t('views.contracts.table.agent')}>{agentName || '—'}</Field>
          <Field label={t('views.contracts.table.period')}>
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {format(parseISO(contract.startDate), 'MMM d, yyyy')}
                <span className="mx-1.5 text-slate-300">—</span>
                {format(parseISO(contract.endDate), 'MMM d, yyyy')}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {term}
              </span>
            </span>
          </Field>
          <Field label={t('views.contracts.summary.monthlyRent')}>
            <span className="text-brand-blue dark:text-blue-300">{formatPhp(contract.monthlyRent)}</span>
          </Field>
          <Field label={t('views.contracts.summary.securityDeposit')}>
            {formatPhp(contract.securityDeposit)}
          </Field>
          <Field label={t('views.contracts.summary.advanceRent')}>
            {formatPhp(contract.advanceRent ?? 0)}
          </Field>
          {created ? (
            <Field label={t('views.contracts.table.dateTime')}>
              {format(created, 'MMM d, yyyy · h:mm a')}
            </Field>
          ) : null}
          {contract.remarks?.trim() ? (
            <div className="sm:col-span-2">
              <Field label={t('views.contracts.summary.remarks')}>
                <span className="font-medium normal-case">{contract.remarks}</span>
              </Field>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
