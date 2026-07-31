import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  CheckCircle2,
  XCircle,
  Upload,
  Trash2,
  Camera,
  Circle,
  CheckCircle,
  Calendar,
  FileText,
  Download,
  MessageSquare,
  SkipForward,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { format } from 'date-fns';
import { Modal } from '@/components/modal';
import { StatusBadge } from '@/components/status-badge';
import { inspectionStatusVariant, statusBadgeClass } from '@/lib/statusBadge';
import { Button, modalActionButtonClass, modalOutlineButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/DatePicker';
import { cn } from '@/lib/utils';
import type {
  Contract,
  InspectionPhotoSection,
  InspectionStatus,
  InspectionWorkflowStep,
  Unit,
  UnitInspectionPayload,
} from '@/types';
import {
  addInspectionPhoto,
  approveInspection,
  deleteInspectionPhoto,
  failInspection,
  fetchContractInspection,
  patchChecklistItem,
  patchInspection,
  patchInventoryItem,
  saveInspectionDraft,
  scheduleInspectionMoveIn,
  startContractInspection,
  downloadInspectionReportPdf,
} from '@/lib/unitInspectionApi';
import { toWebpDataUrl } from '@/lib/imageWebp';
import {
  inspectionReportFileName,
  printInspectionReport,
  type InspectionReportLabels,
} from '@/lib/inspectionReport';

type TabKey = 'overview' | 'checklist' | 'inventory' | 'photos' | 'approval' | 'logs';

const STEPPER_STEPS: Array<{ key: InspectionWorkflowStep; labelKey: string }> = [
  { key: 'overview', labelKey: 'stepOverview' },
  { key: 'checklist', labelKey: 'stepChecklist' },
  { key: 'inventory', labelKey: 'stepInventory' },
  { key: 'photos', labelKey: 'stepPhotos' },
  { key: 'approval', labelKey: 'stepApproval' },
  { key: 'ready', labelKey: 'stepReady' },
];

const PHOTO_SECTIONS: Array<{ key: InspectionPhotoSection; labelKey: string; required?: boolean }> = [
  { key: 'living_room', labelKey: 'livingRoom', required: true },
  { key: 'bedroom', labelKey: 'bedroom', required: true },
  { key: 'kitchen', labelKey: 'kitchen', required: true },
  { key: 'bathroom', labelKey: 'bathroom', required: true },
  { key: 'damages', labelKey: 'damages' },
  { key: 'meter_reading', labelKey: 'meterReading' },
];

const SIDEBAR_ITEMS: Array<{ key: TabKey; labelKey: string }> = [
  { key: 'overview', labelKey: 'navOverview' },
  { key: 'checklist', labelKey: 'navChecklist' },
  { key: 'inventory', labelKey: 'navInventory' },
  { key: 'photos', labelKey: 'navPhotos' },
  { key: 'approval', labelKey: 'navApproval' },
  { key: 'logs', labelKey: 'navLogs' },
];

function SummaryCard({
  title,
  value,
  subValue,
  valueTone,
  statusKey,
  compact,
}: {
  title: string;
  value: string;
  subValue?: string;
  valueTone?: 'status';
  statusKey?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'inspection-summary-card group rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-600 dark:bg-slate-950/80',
        compact ? 'px-3 py-2.5' : 'p-4',
      )}
    >
      <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-300">{title}</div>
      {valueTone === 'status' && value ? (
        <StatusBadge tone={inspectionStatusVariant(statusKey ?? value)} className="mt-1 w-fit text-[10px]">
          {value}
        </StatusBadge>
      ) : (
        <div className={cn('mt-1 font-semibold text-slate-900 dark:text-slate-50', compact ? 'text-xs leading-snug' : 'text-sm')}>
          {value || '—'}
        </div>
      )}
      {subValue ? <div className="mt-0.5 text-[10px] text-slate-500 break-all dark:text-slate-400">{subValue}</div> : null}
    </div>
  );
}

function StepperProgress({
  currentStep,
  t,
}: {
  currentStep: InspectionWorkflowStep;
  t: (key: string) => string;
}) {
  const currentIdx = STEPPER_STEPS.findIndex((s) => s.key === currentStep);
  const activeIdx = currentIdx < 0 ? 0 : currentIdx;

  return (
    <div className="overflow-x-auto px-0.5 py-1">
      <div className="flex min-w-max items-center gap-1 sm:gap-1.5">
        {STEPPER_STEPS.map((step, idx) => {
          const done = idx < activeIdx;
          const active = idx === activeIdx;
          return (
            <React.Fragment key={step.key}>
              <div className="flex items-center gap-1">
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    done
                      ? 'bg-indigo-600 text-white'
                      : active
                        ? 'border-2 border-indigo-500 bg-white text-indigo-700 dark:bg-slate-900 dark:text-indigo-200'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-400',
                  )}
                >
                  {done ? <CheckCircle className="h-3 w-3" /> : idx + 1}
                </div>
                <span
                  className={cn(
                    'hidden text-[10px] font-semibold lg:inline',
                    active ? 'text-indigo-700 dark:text-indigo-200' : 'text-slate-500 dark:text-slate-400',
                  )}
                >
                  {t(`views.inspection.${step.labelKey}`)}
                </span>
              </div>
              {idx < STEPPER_STEPS.length - 1 ? (
                <div
                  className={cn(
                    'h-0.5 w-3 rounded-full sm:w-6',
                    idx < activeIdx ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700',
                  )}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function UnitInspectionWorkflowModal({
  isOpen,
  onClose,
  contract,
  unit,
  tenantName,
  agentName,
  payload,
  loading,
  canWrite,
  onRefresh,
  onPayloadChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | null;
  unit: Unit | null;
  tenantName: string;
  agentName: string;
  payload: UnitInspectionPayload | null;
  loading: boolean;
  canWrite: boolean;
  onRefresh: () => Promise<void>;
  onPayloadChange: (next: UnitInspectionPayload) => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>('overview');
  const [busy, setBusy] = useState(false);
  const [inspectorRemarks, setInspectorRemarks] = useState('');
  const [moveInDate, setMoveInDate] = useState<Date | null>(null);
  const [remarksOpen, setRemarksOpen] = useState<Record<string, boolean>>({});

  const inspection = payload?.inspection ?? null;
  const checklist = payload?.checklist ?? [];
  const inventory = payload?.inventory ?? [];
  const photos = payload?.photos ?? [];
  const logs = payload?.logs ?? [];

  useEffect(() => {
    if (inspection?.inspectorRemarks) setInspectorRemarks(inspection.inspectorRemarks);
  }, [inspection?.inspectorRemarks, inspection?.id]);

  useEffect(() => {
    if (inspection?.scheduledMoveIn) {
      const d = new Date(inspection.scheduledMoveIn);
      if (!Number.isNaN(d.getTime())) setMoveInDate(d);
    }
  }, [inspection?.scheduledMoveIn, inspection?.id]);

  useEffect(() => {
    if (!isOpen) setTab('overview');
  }, [isOpen]);

  const statusLabel = useCallback(
    (status: InspectionStatus | string) => {
      const key = `views.inspection.statuses.${status}`;
      const translated = t(key);
      return translated === key ? status : translated;
    },
    [t],
  );

  const checklistCompleted = useMemo(
    () => checklist.filter((c) => c.result === 'pass' || c.result === 'fail').length,
    [checklist],
  );

  const checklistTotal = checklist.length;
  const checklistPct = inspection?.checklistScore ?? 0;
  const inventoryPct = inspection?.inventoryCompletion ?? 0;

  const photosBySection = useMemo(() => {
    const map: Record<string, typeof photos> = {};
    for (const p of photos) {
      if (!map[p.section]) map[p.section] = [];
      map[p.section].push(p);
    }
    return map;
  }, [photos]);

  const isApproved =
    inspection?.status === 'ready_for_occupancy' || inspection?.status === 'move_in_scheduled';

  const canApprove = checklistPct >= 100 && inventoryPct >= 100;

  const canProceedToApproval = canApprove;

  const approvalBlockReason = useMemo(() => {
    if (checklistPct < 100) return t('views.inspection.approveBlockedChecklist');
    if (inventoryPct < 100) return t('views.inspection.approveBlockedInventory');
    return '';
  }, [checklistPct, inventoryPct, t]);

  const runAction = async (fn: () => Promise<UnitInspectionPayload>, successMsg: string) => {
    setBusy(true);
    try {
      const next = await fn();
      onPayloadChange(next);
      toast.success(successMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const handleStartInspection = () =>
    runAction(
      () => startContractInspection(contract!.id),
      t('views.inspection.started'),
    ).then(() => setTab('checklist'));

  const handleChecklistUpdate = async (
    itemId: string,
    body: { result?: 'pass' | 'fail'; remarks?: string; photoDataUrl?: string },
  ) => {
    if (!inspection || !canWrite) return;
    await runAction(
      () => patchChecklistItem(inspection.id, itemId, body),
      t('views.inspection.checklistSaved'),
    );
  };

  const handleInventoryUpdate = async (
    itemId: string,
    body: { conditionState?: 'good' | 'damaged' | 'missing'; quantity?: number; remarks?: string },
  ) => {
    if (!inspection || !canWrite) return;
    await runAction(
      () => patchInventoryItem(inspection.id, itemId, body),
      t('views.inspection.inventorySaved'),
    );
  };

  const handlePhotoUpload = async (section: InspectionPhotoSection, file: File) => {
    if (!inspection || !canWrite) return;
    try {
      const dataUrl = await toWebpDataUrl(file);
      await runAction(
        () => addInspectionPhoto(inspection.id, { section, photoDataUrl: dataUrl }),
        t('views.inspection.photoUploaded'),
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('views.units.addModal.validationPhotoWebp'),
      );
    }
  };

  const handlePhotoDelete = async (photoId: string) => {
    if (!inspection || !canWrite) return;
    await runAction(
      () => deleteInspectionPhoto(inspection.id, photoId),
      t('views.inspection.photoDeleted'),
    );
  };

  const handleSaveDraft = () => {
    if (!inspection || !canWrite) return;
    return runAction(
      () => saveInspectionDraft(inspection.id, { inspectorRemarks, workflowStep: tab as InspectionWorkflowStep }),
      t('views.inspection.draftSaved'),
    );
  };

  const handleApprove = async () => {
    if (!inspection || !canWrite) return;
    if (!canApprove) {
      toast.error(approvalBlockReason || t('views.inspection.approveBlocked'));
      return;
    }
    setBusy(true);
    try {
      const next = await approveInspection(inspection.id, { inspectorRemarks });
      onPayloadChange(next);
      await Swal.fire({
        icon: 'success',
        title: t('views.inspection.readyTitle'),
        text: t('views.inspection.approved'),
        confirmButtonText: t('common.close'),
        confirmButtonColor: '#4f46e5',
        buttonsStyling: true,
      });
      setTab('approval');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const handleFail = () => {
    if (!inspection || !canWrite) return;
    if (!window.confirm(t('views.inspection.failConfirm'))) return;
    return runAction(
      () => failInspection(inspection.id, { inspectorRemarks }),
      t('views.inspection.failed'),
    );
  };

  const handleScheduleMoveIn = () => {
    if (!inspection || !canWrite || !moveInDate) return;
    return runAction(
      () => scheduleInspectionMoveIn(inspection.id, format(moveInDate, 'yyyy-MM-dd')),
      t('views.inspection.moveInScheduled'),
    );
  };

  const reportLabels = useMemo<InspectionReportLabels>(
    () => ({
      title: t('views.inspection.reportTitle'),
      contractNumber: t('views.inspection.contractNumber'),
      unit: t('views.inspection.unit'),
      tenant: t('views.inspection.tenant'),
      agent: t('views.inspection.agent'),
      period: t('views.inspection.period'),
      status: t('views.inspection.status'),
      checklistScore: t('views.inspection.checklistScore'),
      inventoryVerified: t('views.inspection.inventoryVerified'),
      photosUploaded: t('views.inspection.photosUploaded'),
      inspectorRemarks: t('views.inspection.inspectorRemarks'),
      checklistTitle: t('views.inspection.checklistTitle'),
      inventoryTitle: t('views.inspection.inventoryTitle'),
      photosTitle: t('views.inspection.photosTitle'),
      logsTitle: t('views.inspection.logsTitle'),
      complete: t('views.inspection.complete'),
      incomplete: t('views.inspection.incomplete'),
      pass: t('views.inspection.pass'),
      fail: t('views.inspection.fail'),
      pending: t('views.inspection.pending', { defaultValue: 'Pending' }),
      remarks: t('views.inspection.remarks'),
      quantity: t('views.inspection.quantity'),
      condition: t('views.inspection.conditionLabel', { defaultValue: 'Condition' }),
      generatedOn: t('views.inspection.reportGeneratedOn'),
      sectionLabels: Object.fromEntries(
        PHOTO_SECTIONS.map((section) => [section.key, t(`views.inspection.sections.${section.labelKey}`)]),
      ),
      statusLabels: Object.fromEntries(
        (
          [
            'vacant',
            'under_inspection',
            'pending_approval',
            'ready_for_occupancy',
            'move_in_scheduled',
            'occupied',
            'failed',
          ] as const
        ).map((status) => [status, t(`views.inspection.statuses.${status}`)]),
      ),
      conditionLabels: {
        good: t('views.inspection.condition.good'),
        damaged: t('views.inspection.condition.damaged'),
        missing: t('views.inspection.condition.missing'),
        pending: t('views.inspection.pending', { defaultValue: 'Pending' }),
      },
    }),
    [t],
  );

  const handlePrintReport = async () => {
    if (!inspection || !contract) return;
    setBusy(true);
    try {
      const livePayload = await prepareLiveReportPayload();
      if (!livePayload) return;
      printInspectionReport({
        contract,
        unit,
        tenantName,
        agentName,
        payload: livePayload,
        labels: reportLabels,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.inspection.reportPrintFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!inspection || !contract) return;
    setBusy(true);
    try {
      await prepareLiveReportPayload();
      await downloadInspectionReportPdf(inspection.id, inspectionReportFileName(contract));
      toast.success(t('views.inspection.reportDownloaded'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.inspection.reportDownloadFailed'));
    } finally {
      setBusy(false);
    }
  };

  const prepareLiveReportPayload = async (): Promise<UnitInspectionPayload | null> => {
    if (!contract || !inspection) return null;

    let latest = await fetchContractInspection(contract.id);

    const remarksDirty =
      inspectorRemarks.trim() !== (latest.inspection.inspectorRemarks ?? '').trim();
    if (canWrite && remarksDirty) {
      latest = await saveInspectionDraft(inspection.id, { inspectorRemarks });
    }

    onPayloadChange(latest);

    return {
      ...latest,
      inspection: {
        ...latest.inspection,
        inspectorRemarks: inspectorRemarks.trim() || latest.inspection.inspectorRemarks,
        scheduledMoveIn: moveInDate
          ? format(moveInDate, 'yyyy-MM-dd')
          : latest.inspection.scheduledMoveIn,
      },
    };
  };

  const goToTab = async (next: TabKey) => {
    setTab(next);
    if (!inspection || !canWrite) return;
    if (next === 'approval' && !isApproved) {
      await proceedToApproval();
    }
  };

  const proceedToApproval = async () => {
    if (!inspection || !canWrite || isApproved) return;
    setTab('approval');
    try {
      const nextPayload = await patchInspection(inspection.id, {
        workflowStep: 'approval',
        status:
          inspection.status === 'vacant' ||
          inspection.status === 'under_inspection' ||
          inspection.status === 'failed'
            ? 'pending_approval'
            : inspection.status,
      });
      onPayloadChange(nextPayload);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update workflow');
    }
  };

  const handleSkipPhotosToApproval = async () => {
    if (!inspection || !canWrite) return;
    if (!canProceedToApproval) {
      toast.error(t('views.inspection.skipPhotosBlocked'));
      return;
    }
    if (!inspection.photosComplete) {
      const result = await Swal.fire({
        icon: 'warning',
        title: t('views.inspection.skipPhotosConfirmTitle'),
        text: t('views.inspection.skipPhotosConfirm'),
        showCancelButton: true,
        confirmButtonText: t('views.inspection.confirmContinue'),
        cancelButtonText: t('views.inspection.cancel'),
        confirmButtonColor: '#4f46e5',
        buttonsStyling: true,
        reverseButtons: true,
      });
      if (!result.isConfirmed) return;
    }
    await proceedToApproval();
    toast.success(t('views.inspection.skipPhotosDone'));
  };

  const title = contract
    ? t('views.inspection.modalTitle', { id: contract.contractNo ?? contract.id })
    : t('views.inspection.title');

  const periodLabel = contract
    ? `${format(new Date(contract.startDate), 'MMM d, yyyy')} — ${format(new Date(contract.endDate), 'MMM d, yyyy')}`
    : '—';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="5xl" variant="default" compact>
      <div className="unit-inspection-modal flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            compact
            title={t('views.inspection.unit')}
            value={unit ? `${unit.unitNumber} · ${unit.buildingName}` : '—'}
          />
          <SummaryCard compact title={t('views.inspection.tenant')} value={tenantName || '—'} />
          <SummaryCard compact title={t('views.inspection.period')} value={periodLabel} />
          <SummaryCard
            compact
            title={t('views.inspection.status')}
            value={inspection ? statusLabel(inspection.status) : '—'}
            valueTone="status"
            statusKey={inspection?.status}
          />
        </div>

        <div className="inspection-shell overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-950/80">
          <div className="grid grid-cols-1 lg:grid-cols-[12rem_1fr]">
            {/* Sidebar */}
            <div className="inspection-sidebar flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 p-2.5 dark:border-slate-600 dark:bg-slate-900 lg:flex-col lg:gap-1 lg:overflow-visible lg:border-b-0 lg:border-r lg:p-3">
              {SIDEBAR_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => void goToTab(item.key)}
                  className={cn(
                    'flex shrink-0 items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left text-xs font-semibold leading-snug transition-all lg:w-full',
                    tab === item.key
                      ? 'border-indigo-200 bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100 dark:border-indigo-800 dark:bg-slate-950 dark:text-indigo-200 dark:ring-indigo-900/60'
                      : 'text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900 hover:shadow-sm dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                  )}
                >
                  <span className="min-w-0 flex-1">{t(`views.inspection.${item.labelKey}`)}</span>
                  <ChevronRight
                    className={cn(
                      'ml-1 hidden h-3 w-3 shrink-0 lg:block',
                      tab === item.key ? 'text-indigo-700 dark:text-indigo-300' : 'text-transparent',
                    )}
                  />
                </button>
              ))}
            </div>

            {/* Main content */}
            <div className="min-w-0 bg-white p-4 dark:bg-slate-950/80">
            {loading ? (
              <div className="py-6 text-center text-xs text-slate-500">{t('views.inspection.loading')}</div>
            ) : !payload || !inspection ? (
              <div className="py-6 text-center text-xs text-slate-500">{t('views.inspection.noData')}</div>
            ) : (
              <>
                {tab === 'overview' ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-indigo-100 bg-white p-3 dark:border-indigo-500/20 dark:bg-slate-950/80">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {t('views.inspection.overviewTitle')}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {t('views.inspection.overviewDesc')}
                        </div>
                      </div>
                      <div className="mt-3">
                        <StepperProgress currentStep={inspection.workflowStep} t={t} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <SummaryCard compact title={t('views.inspection.unitType')} value={unit?.type ?? '—'} />
                      <SummaryCard compact title={t('views.inspection.agent')} value={agentName || '—'} />
                      <SummaryCard
                        compact
                        title={t('views.inspection.scheduledMoveIn')}
                        value={
                          inspection.scheduledMoveIn
                            ? format(new Date(inspection.scheduledMoveIn), 'MMM d, yyyy')
                            : '—'
                        }
                      />
                    </div>

                    {inspection.status === 'vacant' && canWrite ? (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 bg-indigo-600 text-xs text-white hover:bg-indigo-700"
                          disabled={busy}
                          onClick={() => void handleStartInspection()}
                        >
                          {t('views.inspection.startInspection')}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {tab === 'checklist' ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950/80">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {t('views.inspection.checklistTitle')}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {t('views.inspection.checklistProgress', {
                              completed: checklistCompleted,
                              total: checklistTotal,
                              pct: Math.round(checklistPct),
                            })}
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                          {Math.round(checklistPct)}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all"
                          style={{ width: `${checklistPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="inspection-list overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
                      {checklist.map((item) => {
                        const showRemarks =
                          remarksOpen[item.id] || item.result === 'fail' || Boolean(item.remarks);
                        return (
                          <div
                            key={item.id}
                            className="inspection-list-row bg-white dark:bg-slate-950/80"
                          >
                            <div className="flex items-center gap-2 px-2.5 py-1.5">
                              {item.result === 'pass' ? (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              ) : item.result === 'fail' ? (
                                <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                              ) : (
                                <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                              )}
                              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                                {item.itemLabel}
                              </span>
                              {item.photoDataUrl ? (
                                <img
                                  src={item.photoDataUrl}
                                  alt=""
                                  className="h-6 w-6 shrink-0 rounded border border-slate-200 object-cover"
                                />
                              ) : null}
                              {canWrite ? (
                                <div className="flex shrink-0 items-center gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={item.result === 'pass' ? 'default' : 'outline'}
                                    className={cn(
                                      'h-6 px-2 text-[10px]',
                                      item.result === 'pass' && 'bg-emerald-600 hover:bg-emerald-700',
                                    )}
                                    disabled={busy}
                                    onClick={() => void handleChecklistUpdate(item.id, { result: 'pass' })}
                                  >
                                    {t('views.inspection.pass')}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={item.result === 'fail' ? 'default' : 'outline'}
                                    className={cn(
                                      'h-6 px-2 text-[10px]',
                                      item.result === 'fail' && 'bg-rose-600 hover:bg-rose-700',
                                    )}
                                    disabled={busy}
                                    onClick={() => {
                                      setRemarksOpen((prev) => ({ ...prev, [item.id]: true }));
                                      void handleChecklistUpdate(item.id, { result: 'fail' });
                                    }}
                                  >
                                    {t('views.inspection.fail')}
                                  </Button>
                                  <label className="cursor-pointer">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      e.target.value = '';
                                      if (!file) return;
                                      try {
                                        const dataUrl = await toWebpDataUrl(file);
                                        void handleChecklistUpdate(item.id, { photoDataUrl: dataUrl });
                                      } catch (err) {
                                        toast.error(
                                          err instanceof Error
                                            ? err.message
                                            : t('views.units.addModal.validationPhotoWebp'),
                                        );
                                      }
                                    }}
                                    />
                                    <span className="inspection-icon-btn inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
                                      <Camera className="h-3 w-3" />
                                    </span>
                                  </label>
                                  <button
                                    type="button"
                                    title={t('views.inspection.remarks')}
                                    className={cn(
                                      'inspection-icon-btn inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900',
                                      showRemarks && 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-700',
                                    )}
                                    onClick={() =>
                                      setRemarksOpen((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                                    }
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            {canWrite && showRemarks ? (
                              <div className="inspection-remarks-row border-t border-slate-200 px-2.5 py-1.5 dark:border-slate-700">
                                <Input
                                  className="h-7 rounded-md text-[11px]"
                                  placeholder={t('views.inspection.remarksPlaceholder')}
                                  defaultValue={item.remarks}
                                  onBlur={(e) => {
                                    const v = e.target.value.trim();
                                    if (v !== item.remarks) void handleChecklistUpdate(item.id, { remarks: v });
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {tab === 'inventory' ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950/80">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {t('views.inspection.inventoryTitle')}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {t('views.inspection.inventoryProgress', { pct: Math.round(inventoryPct) })}
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                          {Math.round(inventoryPct)}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all"
                          style={{ width: `${inventoryPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="inspection-list overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
                      {inventory.map((item) => (
                        <div
                          key={item.id}
                          className="inspection-list-row bg-white px-2.5 py-1.5 dark:bg-slate-950/80"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                              {item.itemLabel}
                            </span>
                            {canWrite ? (
                              <div className="flex shrink-0 items-center gap-1">
                                {(['good', 'damaged', 'missing'] as const).map((state) => (
                                  <Button
                                    key={state}
                                    type="button"
                                    size="sm"
                                    variant={item.conditionState === state ? 'default' : 'outline'}
                                    className="h-6 px-1.5 text-[10px] capitalize"
                                    disabled={busy}
                                    onClick={() =>
                                      void handleInventoryUpdate(item.id, { conditionState: state })
                                    }
                                  >
                                    {t(`views.inspection.condition.${state}`)}
                                  </Button>
                                ))}
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-6 w-12 rounded-md px-1 text-center text-[10px]"
                                  defaultValue={item.quantity}
                                  title={t('views.inspection.quantity')}
                                  onBlur={(e) => {
                                    const qty = Number(e.target.value);
                                    if (!Number.isNaN(qty) && qty !== item.quantity) {
                                      void handleInventoryUpdate(item.id, { quantity: qty });
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', statusBadgeClass('neutral'))}>
                                {item.conditionState}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {tab === 'photos' ? (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {t('views.inspection.photosTitle')}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{t('views.inspection.photosDesc')}</div>
                        {!inspection.photosComplete ? (
                          <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                            {t('views.inspection.skipPhotosHint')}
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] text-emerald-700 dark:text-emerald-300">
                            {t('views.inspection.photosCompleteHint')}
                          </div>
                        )}
                      </div>
                      {canWrite && !isApproved ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0 bg-indigo-600 text-xs text-white hover:bg-indigo-700"
                          disabled={busy || !canProceedToApproval}
                          onClick={() => void handleSkipPhotosToApproval()}
                        >
                          <SkipForward className="mr-1.5 h-3.5 w-3.5" />
                          {t('views.inspection.skipToApproval')}
                        </Button>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {PHOTO_SECTIONS.map((section) => {
                        const sectionPhotos = photosBySection[section.key] ?? [];
                        return (
                          <div
                            key={section.key}
                            className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-950/80"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                {t(`views.inspection.sections.${section.labelKey}`)}
                                {section.required ? (
                                  <span className="ml-0.5 text-[10px] font-normal text-rose-500">*</span>
                                ) : null}
                              </div>
                              {canWrite ? (
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={async (e) => {
                                      const files = Array.from(e.target.files ?? []);
                                      e.target.value = '';
                                      for (const file of files) {
                                        await handlePhotoUpload(section.key, file);
                                      }
                                    }}
                                  />
                                  <span className="inline-flex h-6 items-center gap-1 rounded bg-indigo-600 px-2 text-[10px] text-white hover:bg-indigo-700">
                                    <Upload className="h-3 w-3" />
                                    {t('views.inspection.upload')}
                                  </span>
                                </label>
                              ) : null}
                            </div>
                            {sectionPhotos.length === 0 ? (
                              <div className="py-3 text-center text-[10px] text-slate-400">{t('views.inspection.noPhotos')}</div>
                            ) : (
                              <div className="grid grid-cols-3 gap-1.5">
                                {sectionPhotos.map((p) => (
                                  <div key={p.id} className="group relative">
                                    <img
                                      src={p.photoDataUrl}
                                      alt=""
                                      className="aspect-square w-full rounded-md border border-slate-200 object-cover"
                                    />
                                    {canWrite ? (
                                      <button
                                        type="button"
                                        className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-rose-600 opacity-0 shadow transition group-hover:opacity-100"
                                        onClick={() => void handlePhotoDelete(p.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {tab === 'approval' ? (
                  <div className="space-y-3">
                    {isApproved ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
                        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                        <div className="mt-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">
                          {t('views.inspection.readyTitle')}
                        </div>
                        <div className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                          {t('views.inspection.readyDesc')}
                        </div>
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          {canWrite ? (
                            <div className="flex items-center gap-2">
                              <DatePicker
                                mode="single"
                                value={moveInDate}
                                onChange={(d) => setMoveInDate((d as Date | null) ?? null)}
                                placeholder={t('views.inspection.scheduledMoveIn')}
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 bg-indigo-600 text-xs text-white hover:bg-indigo-700"
                                disabled={busy || !moveInDate}
                                onClick={() => void handleScheduleMoveIn()}
                              >
                                <Calendar className="mr-1 h-3.5 w-3.5" />
                                {t('views.inspection.scheduleMoveIn')}
                              </Button>
                            </div>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={busy}
                            onClick={() => void handlePrintReport()}
                          >
                            <FileText className="mr-1 h-3.5 w-3.5" />
                            {t('views.inspection.printReport')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={busy}
                            onClick={() => void handleDownloadReport()}
                          >
                            <Download className="mr-1 h-3.5 w-3.5" />
                            {t('views.inspection.downloadPdf')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {t('views.inspection.approvalTitle')}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {t('views.inspection.approvalDesc')}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <SummaryCard compact title={t('views.inspection.checklistScore')} value={`${Math.round(checklistPct)}%`} />
                          <SummaryCard compact title={t('views.inspection.inventoryVerified')} value={`${Math.round(inventoryPct)}%`} />
                          <SummaryCard
                            compact
                            title={t('views.inspection.photosUploaded')}
                            value={inspection.photosComplete ? t('views.inspection.complete') : t('views.inspection.incomplete')}
                          />
                          <SummaryCard compact title={t('views.inspection.inspectorRemarks')} value={inspectorRemarks || '—'} />
                        </div>

                        {canWrite ? (
                          <div className="space-y-1">
                            <Label className="text-[10px]">{t('views.inspection.inspectorRemarks')}</Label>
                            <Textarea
                              className="min-h-[72px] rounded-lg text-xs"
                              value={inspectorRemarks}
                              onChange={(e) => setInspectorRemarks(e.target.value)}
                              placeholder={t('views.inspection.remarksPlaceholder')}
                            />
                          </div>
                        ) : null}

                        {!canApprove ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            {approvalBlockReason || t('views.inspection.approveBlocked')}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}

                {tab === 'logs' ? (
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {t('views.inspection.logsTitle')}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{t('views.inspection.logsDesc')}</div>
                    </div>

                    <div className="relative space-y-0">
                      {logs.length === 0 ? (
                        <div className="py-4 text-center text-[10px] text-slate-400">{t('views.inspection.noLogs')}</div>
                      ) : (
                        logs.map((log, idx) => (
                          <div key={log.id} className="relative flex gap-2.5 pb-3">
                            {idx < logs.length - 1 ? (
                              <div className="absolute left-[5px] top-3 h-full w-px bg-slate-200 dark:bg-slate-700" />
                            ) : null}
                            <div className="relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-indigo-500 bg-white dark:bg-slate-900" />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] text-slate-400">{log.createdAt || '—'}</div>
                              <div className="text-xs font-medium text-slate-900 dark:text-slate-100">{log.message}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
        </div>

        {/* Sticky footer actions */}
        {inspection && canWrite && tab === 'approval' && !isApproved ? (
          <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-200 bg-white px-1 py-2 dark:border-slate-600 dark:bg-slate-950">
            <Button type="button" variant="outline" className={modalOutlineButtonClass} disabled={busy} onClick={() => void handleSaveDraft()}>
              {t('views.inspection.saveDraft')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn(modalOutlineButtonClass, 'border-rose-300 text-rose-700 hover:bg-rose-50')}
              disabled={busy}
              onClick={() => void handleFail()}
            >
              {t('views.inspection.failInspection')}
            </Button>
            <Button
              type="button"
              className={modalActionButtonClass}
              disabled={busy || !canApprove}
              onClick={() => void handleApprove()}
            >
              {t('views.inspection.approveUnit')}
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
