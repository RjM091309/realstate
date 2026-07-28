import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Info,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react';
import { Button, modalOutlineButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  startOfDay,
  parseISO,
  startOfWeek,
  endOfWeek,
  isSameMonth
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { fetchUnits } from '@/lib/unitsApi';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchPayments } from '@/lib/paymentsApi';
import { fetchTenants } from '@/lib/tenantsApi';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  updateCalendarEvent,
  type CalendarEvent,
  type CalendarEventType,
} from '@/lib/calendarEventsApi';
import type { Contract, Payment, Tenant, Unit } from '@/types';
import { Modal } from '@/components/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select2 } from '@/components/select2';
import { toast } from 'sonner';

function formatPhp(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return `₱${amount.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function formatEventDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    const d = value instanceof Date ? value : parseISO(String(value));
    return format(d, 'MMM dd, yyyy');
  } catch {
    return String(value);
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm leading-snug text-slate-900 dark:text-slate-100">{value ?? '—'}</dd>
    </div>
  );
}

/** Soften ALL-CAPS names from CRM into readable title case. */
function formatPersonName(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  if (raw !== raw.toUpperCase() || raw.length < 3) return raw;
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{children}</h3>
  );
}

type UiEvent = {
  id: string;
  date: Date;
  typeLabel: string;
  unitId: string;
  color: string;
  /** When set, use inline background (hex) instead of `color` Tailwind class. */
  colorHex?: string | null;
  icon: React.ReactNode;
  source: 'derived' | 'custom';
  raw?: CalendarEvent;
  contractId?: string | null;
  paymentId?: string | null;
};

function eventAccent(ev: Pick<UiEvent, 'color' | 'colorHex'>): string {
  if (ev.colorHex) return ev.colorHex;
  if (ev.color.includes('emerald')) return '#10b981';
  if (ev.color.includes('rose')) return '#f43f5e';
  if (ev.color.includes('blue')) return '#3b82f6';
  if (ev.color.includes('amber')) return '#f59e0b';
  if (ev.color.includes('indigo')) return '#4f46e5';
  return '#64748b';
}

const CALENDAR_FORM_INPUT =
  'h-12 rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950/80';

const CALENDAR_SELECT_CLASS = '[&_.unit-form-select-control]:!min-h-12';

function pickContractForCalendarEvent(
  list: Contract[],
  unitId: string,
  eventType: CalendarEventType,
  eventDate: string,
): Contract | undefined {
  const forUnit = list.filter((c) => c.unitId === unitId);
  if (forUnit.length === 0) return undefined;
  if (eventType === 'move_in') {
    const byStart = forUnit.find((c) => c.startDate === eventDate);
    if (byStart) return byStart;
  }
  if (eventType === 'move_out') {
    const byEnd = forUnit.find((c) => c.endDate === eventDate);
    if (byEnd) return byEnd;
  }
  const active = forUnit.find((c) => c.status === 'Active');
  if (active) return active;
  return [...forUnit].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
}

function findPaymentScheduleForEvent(
  list: Payment[],
  unitId: string,
  eventDate: string,
  eventType: CalendarEventType,
  contractId?: string | null,
): string | null {
  if (eventType !== 'payment_due' && eventType !== 'payment_received') return null;
  const row = list.find(
    (p) => p.unitId === unitId && p.dueDate === eventDate && (!contractId || p.contractId === contractId),
  );
  return row?.id ?? null;
}

type EventForm = {
  eventType: CalendarEventType;
  eventDate: string;
  title: string;
  unitId: string;
  colorCode: string;
};

function defaultEventForm(today: Date, unitId: string): EventForm {
  return {
    eventType: 'inspection',
    eventDate: format(today, 'yyyy-MM-dd'),
    title: 'Inspection',
    unitId,
    colorCode: '#4f46e5',
  };
}

export function CalendarView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const canCreate = session?.crud?.calendar?.create ?? false;
  const canUpdate = session?.crud?.calendar?.update ?? false;
  const canDelete = session?.crud?.calendar?.delete ?? false;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [units, setUnits] = useState<Unit[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [customEvents, setCustomEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventFormMode, setEventFormMode] = useState<'create' | 'edit'>('create');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<EventForm>(() => defaultEventForm(new Date(), ''));

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsEvent, setDetailsEvent] = useState<UiEvent | null>(null);

  useEffect(() => {
    void (async () => {
      let hadError = false;
      try {
        try {
          setUnits(await fetchUnits());
        } catch {
          hadError = true;
          setUnits([]);
        }
        try {
          setContracts(await fetchContracts());
        } catch {
          hadError = true;
          setContracts([]);
        }
        try {
          setPayments(await fetchPayments());
        } catch {
          hadError = true;
          setPayments([]);
        }
        try {
          setTenants(await fetchTenants());
        } catch {
          hadError = true;
          setTenants([]);
        }
        try {
          setCustomEvents(await fetchCalendarEvents());
        } catch {
          hadError = true;
          setCustomEvents([]);
        }
        if (hadError) toast.warning(t('views.calendar.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const calendarGridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const events = useMemo<UiEvent[]>(() => {
    const derived: UiEvent[] = [
      ...contracts.map((c) => ({
        id: `move-in-${c.id}`,
        date: startOfDay(parseISO(c.startDate)),
        typeLabel: t('views.calendar.eventTypes.moveIn'),
        unitId: c.unitId,
        color: 'bg-emerald-500',
        icon: <ArrowRight className="w-3 h-3" />,
        source: 'derived' as const,
        contractId: c.id,
      })),
      ...contracts.map((c) => ({
        id: `move-out-${c.id}`,
        date: startOfDay(parseISO(c.endDate)),
        typeLabel: t('views.calendar.eventTypes.moveOut'),
        unitId: c.unitId,
        color: 'bg-rose-500',
        icon: <ArrowLeft className="w-3 h-3" />,
        source: 'derived' as const,
        contractId: c.id,
      })),
      ...payments.map((p) => ({
        id: `payment-due-${p.id}`,
        date: startOfDay(parseISO(p.dueDate)),
        typeLabel: t('views.calendar.eventTypes.paymentDue'),
        unitId: p.unitId,
        color: p.status === 'Paid' ? 'bg-blue-500' : 'bg-amber-500',
        icon: <DollarSign className="w-3 h-3" />,
        source: 'derived' as const,
        contractId: p.contractId,
        paymentId: p.id,
      })),
    ];

    const custom: UiEvent[] = customEvents.map((e) => {
      const date = startOfDay(parseISO(e.eventDate));
      const unitIdFromContract =
        e.contractId != null ? contracts.find((c) => c.id === e.contractId)?.unitId : undefined;
      const unitIdFromPayment =
        e.paymentScheduleId != null ? payments.find((p) => p.id === e.paymentScheduleId)?.unitId : undefined;
      const unitIdFromMeta =
        e.metadata && typeof e.metadata === 'object' && e.metadata !== null && 'unitId' in e.metadata
          ? String(e.metadata.unitId ?? '').trim()
          : '';
      const unitId = unitIdFromContract ?? unitIdFromPayment ?? unitIdFromMeta ?? '';
      const hex = e.colorCode && e.colorCode.trim() !== '' ? e.colorCode.trim() : null;

      const label =
        e.eventType === 'move_in'
          ? t('views.calendar.eventTypes.moveIn')
          : e.eventType === 'move_out'
            ? t('views.calendar.eventTypes.moveOut')
            : e.eventType === 'payment_due'
              ? t('views.calendar.eventTypes.paymentDue')
              : e.eventType === 'payment_received'
                ? t('views.calendar.eventTypes.paymentReceived')
                : e.eventType === 'inspection'
                  ? t('views.calendar.eventTypes.inspection')
                  : t('views.calendar.eventTypes.other');

      const color =
        hex
          ? 'bg-slate-500'
          : e.eventType === 'inspection'
            ? 'bg-indigo-500'
            : e.eventType === 'payment_received'
              ? 'bg-blue-500'
              : 'bg-slate-500';

      const icon =
        e.eventType === 'payment_due' || e.eventType === 'payment_received' ? (
          <DollarSign className="w-3 h-3" />
        ) : e.eventType === 'move_in' ? (
          <ArrowRight className="w-3 h-3" />
        ) : e.eventType === 'move_out' ? (
          <ArrowLeft className="w-3 h-3" />
        ) : (
          <Info className="w-3 h-3" />
        );

      return {
        id: `custom-${e.id}`,
        date,
        typeLabel: e.title || label,
        unitId,
        color,
        colorHex: hex,
        icon,
        source: 'custom',
        raw: e,
        contractId: e.contractId,
      };
    });

    return [...derived, ...custom].filter((ev) => ev.unitId);
  }, [contracts, customEvents, payments, t]);

  const unitOptions = useMemo(
    () => units.map((u) => ({ value: u.id, label: `${u.unitNumber} - ${u.buildingName}` })),
    [units],
  );

  const eventTypeOptions = useMemo(
    () => [
      { value: 'inspection', label: t('views.calendar.eventTypes.inspection') },
      { value: 'other', label: t('views.calendar.eventTypes.other') },
      { value: 'move_in', label: t('views.calendar.eventTypes.moveIn') },
      { value: 'move_out', label: t('views.calendar.eventTypes.moveOut') },
      { value: 'payment_due', label: t('views.calendar.eventTypes.paymentDue') },
      { value: 'payment_received', label: t('views.calendar.eventTypes.paymentReceived') },
    ],
    [t],
  );

  const openCreateEvent = useCallback(() => {
    const day = selectedDay ?? new Date();
    const fallbackUnit = units[0]?.id ?? '';
    setEventFormMode('create');
    setEditingEventId(null);
    setEventForm(defaultEventForm(day, fallbackUnit));
    setEventModalOpen(true);
  }, [selectedDay, units]);

  const openDetails = useCallback((ev: UiEvent) => {
    setDetailsEvent(ev);
    setDetailsOpen(true);
  }, []);

  const closeDetails = useCallback(() => {
    setDetailsOpen(false);
    setDetailsEvent(null);
  }, []);

  const openEditEvent = useCallback(
    (ev: UiEvent) => {
      if (ev.source !== 'custom' || !ev.raw) return;
      const unitIdFromContract =
        ev.raw.contractId != null ? contracts.find((c) => c.id === ev.raw.contractId)?.unitId : undefined;
      const unitIdFromPayment =
        ev.raw.paymentScheduleId != null ? payments.find((p) => p.id === ev.raw.paymentScheduleId)?.unitId : undefined;
      const unitIdFromMeta =
        ev.raw.metadata && typeof ev.raw.metadata === 'object' && ev.raw.metadata !== null && 'unitId' in ev.raw.metadata
          ? String((ev.raw.metadata as { unitId?: string }).unitId ?? '').trim()
          : '';
      const unitId = unitIdFromContract ?? unitIdFromPayment ?? unitIdFromMeta ?? units[0]?.id ?? '';
      setEventFormMode('edit');
      setEditingEventId(ev.raw.id);
      setEventForm({
        eventType: ev.raw.eventType,
        eventDate: ev.raw.eventDate,
        title: ev.raw.title,
        unitId,
        colorCode: ev.raw.colorCode ?? '',
      });
      setEventModalOpen(true);
    },
    [contracts, payments, units],
  );

  const closeEventModal = useCallback(() => {
    setEventModalOpen(false);
    setEventFormMode('create');
    setEditingEventId(null);
  }, []);

  const saveEvent = useCallback(async () => {
    if (!eventForm.unitId || !eventForm.eventDate || !eventForm.title.trim()) {
      toast.error(t('views.calendar.validationRequired'));
      return;
    }
    const unit = units.find((u) => u.id === eventForm.unitId);
    const buildingHint = unit ? `${unit.unitNumber} - ${unit.buildingName}` : '';
    const contract = pickContractForCalendarEvent(
      contracts,
      eventForm.unitId,
      eventForm.eventType,
      eventForm.eventDate,
    );
    const contractId = contract?.id ?? null;
    const paymentScheduleId =
      findPaymentScheduleForEvent(
        payments,
        eventForm.unitId,
        eventForm.eventDate,
        eventForm.eventType,
        contractId,
      ) ?? null;
    const body = {
      eventType: eventForm.eventType,
      eventDate: eventForm.eventDate,
      title: eventForm.title.trim(),
      colorCode: eventForm.colorCode.trim() || null,
      contractId,
      paymentScheduleId,
      metadata: { unitId: eventForm.unitId, buildingHint, contractId, paymentScheduleId },
    };
    try {
      if (eventFormMode === 'edit' && editingEventId) {
        const updated = await updateCalendarEvent(editingEventId, body);
        setCustomEvents((prev) => prev.map((e) => (e.id === editingEventId ? updated : e)));
        toast.success(t('views.calendar.updated'));
      } else {
        const created = await createCalendarEvent(body);
        setCustomEvents((prev) => [created, ...prev]);
        toast.success(t('views.calendar.created'));
      }
      closeEventModal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.calendar.saveError'));
    }
  }, [closeEventModal, contracts, editingEventId, eventForm, eventFormMode, payments, t, units]);

  const removeEvent = useCallback(
    async (ev: UiEvent) => {
      if (ev.source !== 'custom' || !ev.raw) return;
      if (!window.confirm(t('views.calendar.deleteConfirm', { title: ev.raw.title }))) return;
      try {
        await deleteCalendarEvent(ev.raw.id);
        setCustomEvents((prev) => prev.filter((e) => e.id !== ev.raw.id));
        toast.success(t('views.calendar.deleted'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('views.calendar.deleteError'));
      }
    },
    [t],
  );

  const openPreview = useCallback((type: 'contract' | 'invoice', id: string) => {
    const url = `${window.location.origin}/preview?type=${type}&id=${encodeURIComponent(id)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return events.filter((e) => isSameDay(e.date, selectedDay));
  }, [selectedDay, events]);

  const resolveEventLine = useCallback(
    (event: UiEvent) => {
      const unit = units.find((u) => u.id === event.unitId);
      const contract =
        (event.contractId ? contracts.find((c) => c.id === event.contractId) : undefined) ??
        undefined;
      const tenant = contract ? tenants.find((tn) => tn.id === contract.tenantId) : undefined;
      const payment = event.paymentId ? payments.find((p) => p.id === event.paymentId) : undefined;
      const unitText = unit
        ? t('views.calendar.unitLabel', { unitNumber: unit.unitNumber })
        : null;
      const parts = [unitText, tenant?.name, payment ? formatPhp(payment.amount) : null].filter(
        Boolean,
      );
      return {
        unit,
        tenant,
        payment,
        unitNumber: unit?.unitNumber ?? null,
        subtitle: parts.join(' · ') || '—',
        shortLabel: unit?.unitNumber
          ? `${event.typeLabel} · ${unit.unitNumber}`
          : event.typeLabel,
      };
    },
    [contracts, payments, t, tenants, units],
  );

  const detailsContext = useMemo(() => {
    if (!detailsEvent) return null;
    const unit = units.find((u) => u.id === detailsEvent.unitId) ?? null;
    const contractId =
      detailsEvent.contractId ??
      detailsEvent.raw?.contractId ??
      null;
    let contract =
      (contractId ? contracts.find((c) => c.id === contractId) : undefined) ??
      null;
    if (!contract && detailsEvent.unitId) {
      const eventType = (detailsEvent.raw?.eventType ??
        (detailsEvent.id.startsWith('move-in-')
          ? 'move_in'
          : detailsEvent.id.startsWith('move-out-')
            ? 'move_out'
            : detailsEvent.id.startsWith('payment-due-')
              ? 'payment_due'
              : 'other')) as CalendarEventType;
      contract =
        pickContractForCalendarEvent(
          contracts,
          detailsEvent.unitId,
          eventType,
          format(detailsEvent.date, 'yyyy-MM-dd'),
        ) ?? null;
    }
    const paymentId = detailsEvent.paymentId ?? detailsEvent.raw?.paymentScheduleId ?? null;
    const payment =
      (paymentId ? payments.find((p) => p.id === paymentId) : undefined) ??
      (contract
        ? payments.find(
            (p) =>
              p.contractId === contract.id &&
              p.dueDate === format(detailsEvent.date, 'yyyy-MM-dd'),
          )
        : undefined) ??
      null;
    const tenant =
      (contract ? tenants.find((tn) => tn.id === contract.tenantId) : undefined) ?? null;
    return { unit, contract, payment, tenant };
  }, [contracts, detailsEvent, payments, tenants, units]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {t('views.calendar.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('views.calendar.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate ? (
            <Button
              className="h-9 rounded-lg bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-700"
              onClick={openCreateEvent}
              disabled={loading}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t('views.calendar.addEvent')}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const today = new Date();
              setCurrentMonth(today);
              setSelectedDay(today);
            }}
            className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900"
          >
            {t('views.calendar.today')}
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={prevMonth}
              className="h-9 w-9 text-slate-500 hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[8.5rem] text-center text-sm font-medium text-slate-800 dark:text-slate-100">
              {format(currentMonth, 'MMMM yyyy')}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextMonth}
              className="h-9 w-9 text-slate-500 hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {t('views.calendar.moveIn')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          {t('views.calendar.moveOut')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          {t('views.calendar.paymentPaid')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {t('views.calendar.paymentPending')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />
          {t('views.calendar.eventTypes.inspection')}
        </span>
      </div>

      <div className="calendar-month-grid overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/40">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div
              key={d}
              className="calendar-month-grid-cell border-r border-slate-200 px-1 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500 last:border-r-0 dark:border-slate-700 dark:text-slate-400"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarGridDays.map((day, index) => {
            const dayEvents = events.filter((e) => isSameDay(e.date, day));
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTday = isToday(day);
            const isLastCol = (index + 1) % 7 === 0;

            return (
              <div
                key={day.toString()}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDay(day)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDay(day);
                  }
                }}
                className={cn(
                  'calendar-month-grid-cell min-h-[5.5rem] cursor-pointer border-b border-slate-200 p-1.5 text-left transition-colors dark:border-slate-700',
                  !isLastCol && 'border-r border-slate-200 dark:border-slate-700',
                  !isCurrentMonth && 'bg-slate-50/50 text-slate-300 dark:bg-slate-900/30',
                  isSelected && 'bg-indigo-50/60 dark:bg-indigo-500/10',
                  isCurrentMonth && !isSelected && 'bg-white hover:bg-slate-50 dark:bg-transparent dark:hover:bg-slate-900/40',
                )}
              >
                <span
                  className={cn(
                    'mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    isTday && 'bg-indigo-600 text-white',
                    isSelected && !isTday && 'text-indigo-600',
                    !isTday && !isSelected && isCurrentMonth && 'text-slate-600 dark:text-slate-300',
                  )}
                >
                  {format(day, 'd')}
                </span>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => {
                    const accent = eventAccent(ev);
                    const { shortLabel } = resolveEventLine(ev);
                    return (
                      <div
                        key={ev.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay(day);
                          openDetails(ev);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedDay(day);
                            openDetails(ev);
                          }
                        }}
                        className="truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight hover:opacity-80"
                        style={{
                          backgroundColor: `${accent}18`,
                          color: accent,
                          borderLeft: `2px solid ${accent}`,
                        }}
                        title={shortLabel}
                      >
                        {shortLabel}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 ? (
                    <p className="pl-1 text-[10px] text-slate-400">+{dayEvents.length - 3}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {t('views.calendar.dailySchedule')}
            </h2>
            <p className="text-xs text-slate-500">
              {selectedDay ? format(selectedDay, 'MMMM dd, yyyy') : t('views.calendar.selectDate')}
              {selectedDay && isToday(selectedDay) ? ` · ${t('views.calendar.today')}` : ''}
            </p>
          </div>
          <p className="text-xs text-slate-400">
            {selectedDayEvents.length}{' '}
            {selectedDayEvents.length === 1
              ? t('views.calendar.eventSingular', 'event')
              : t('views.calendar.eventPlural', 'events')}
          </p>
        </div>

        {selectedDayEvents.length > 0 ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {selectedDayEvents.map((event) => {
              const line = resolveEventLine(event);
              const accent = eventAccent(event);
              return (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: accent }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {event.typeLabel}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{line.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {event.source === 'custom' && canUpdate ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-slate-600"
                        onClick={() => openEditEvent(event)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        {t('views.calendar.edit')}
                      </Button>
                    ) : null}
                    {event.source === 'custom' && canDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-rose-600"
                        onClick={() => void removeEvent(event)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        {t('views.calendar.delete')}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-indigo-600 hover:text-indigo-700"
                      onClick={() => openDetails(event)}
                    >
                      {t('views.calendar.viewDetails')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-2 text-sm text-slate-500">{t('views.calendar.noEvents')}</p>
        )}
      </section>

      <Modal
        isOpen={eventModalOpen}
        onClose={closeEventModal}
        title={eventFormMode === 'edit' ? t('views.calendar.editEvent') : t('views.calendar.addEvent')}
        maxWidth="2xl"
        variant="glass"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" className={modalOutlineButtonClass} onClick={closeEventModal}>
              {t('views.calendar.cancel')}
            </Button>
            <Button type="button" className={modalPrimaryButtonClass} onClick={() => void saveEvent()}>
              {eventFormMode === 'edit' ? t('views.calendar.save') : t('views.calendar.create')}
            </Button>
          </div>
        }
      >
        <div className="unit-form-fields flex flex-col gap-5">
          <div className="space-y-1.5">
            <Label>{t('views.calendar.eventTitle')}</Label>
            <Input
              className={CALENDAR_FORM_INPUT}
              value={eventForm.title}
              onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
            <div className="min-w-0 space-y-1.5">
              <Label>{t('views.calendar.eventDate')}</Label>
              <Input
                type="date"
                className={cn(CALENDAR_FORM_INPUT, 'w-full')}
                value={eventForm.eventDate}
                onChange={(e) => setEventForm((p) => ({ ...p, eventDate: e.target.value }))}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>{t('views.calendar.eventType')}</Label>
              <Select2
                borderless={false}
                className={CALENDAR_SELECT_CLASS}
                options={eventTypeOptions}
                value={eventForm.eventType}
                onChange={(v) => setEventForm((p) => ({ ...p, eventType: (v ?? 'other') as CalendarEventType }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('views.calendar.unit')}</Label>
            <Select2
              borderless={false}
              className={CALENDAR_SELECT_CLASS}
              options={unitOptions}
              value={eventForm.unitId}
              onChange={(v) => setEventForm((p) => ({ ...p, unitId: (v ?? '') as string }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('views.calendar.color')}</Label>
            <Input
              className={CALENDAR_FORM_INPUT}
              placeholder="#4f46e5"
              value={eventForm.colorCode}
              onChange={(e) => setEventForm((p) => ({ ...p, colorCode: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={detailsOpen}
        onClose={closeDetails}
        title={t('views.calendar.viewDetails')}
        maxWidth="2xl"
        variant="glass"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" className={modalOutlineButtonClass} onClick={closeDetails}>
              {t('views.calendar.cancel')}
            </Button>
            {(detailsEvent?.contractId || detailsContext?.contract?.id) ? (
              <Button
                type="button"
                variant="outline"
                className={modalOutlineButtonClass}
                onClick={() =>
                  openPreview(
                    'invoice',
                    String(detailsEvent?.contractId || detailsContext?.contract?.id),
                  )
                }
              >
                {t('views.contracts.table.viewInvoice')}
              </Button>
            ) : null}
            {(detailsEvent?.contractId || detailsContext?.contract?.id) ? (
              <Button
                type="button"
                className={modalPrimaryButtonClass}
                onClick={() =>
                  openPreview(
                    'contract',
                    String(detailsEvent?.contractId || detailsContext?.contract?.id),
                  )
                }
              >
                {t('views.contracts.table.viewContract')}
              </Button>
            ) : null}
            {detailsEvent?.source === 'custom' && canUpdate ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 px-3 text-sm text-slate-600"
                onClick={() => openEditEvent(detailsEvent)}
              >
                {t('views.calendar.edit')}
              </Button>
            ) : null}
            {detailsEvent?.source === 'custom' && canDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 px-3 text-sm text-rose-600"
                onClick={() => void removeEvent(detailsEvent)}
              >
                {t('views.calendar.delete')}
              </Button>
            ) : null}
          </div>
        }
      >
        {detailsEvent && detailsContext ? (
          <div className="max-h-[min(64vh,32rem)] space-y-7 overflow-y-auto pr-1">
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {detailsEvent.typeLabel}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {formatEventDate(detailsEvent.date)}
                {' · '}
                {detailsEvent.source === 'custom'
                  ? t('views.calendar.customEvent')
                  : t('views.calendar.systemEvent')}
              </p>
            </div>

            {detailsContext.unit ? (
              <section className="space-y-3">
                <SectionTitle>{t('views.calendar.details.unitInfo')}</SectionTitle>
                <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
                  <Field
                    label={t('views.calendar.unit')}
                    value={t('views.calendar.unitLabel', {
                      unitNumber: detailsContext.unit.unitNumber,
                    })}
                  />
                  <Field
                    label={t('views.calendar.details.building')}
                    value={detailsContext.unit.buildingName || '—'}
                  />
                  <Field label={t('views.calendar.details.floor')} value={detailsContext.unit.floor || '—'} />
                  <Field
                    label={t('views.calendar.details.status')}
                    value={detailsContext.unit.status || '—'}
                  />
                  <div className="sm:col-span-2">
                    <Field
                      label={t('views.calendar.details.address')}
                      value={
                        detailsContext.unit.legalAddress ||
                        detailsContext.unit.commonAddress ||
                        '—'
                      }
                    />
                  </div>
                  <Field
                    label={t('views.calendar.details.monthlyRate')}
                    value={formatPhp(detailsContext.unit.monthlyRate)}
                  />
                </dl>
              </section>
            ) : null}

            {detailsContext.tenant ? (
              <section className="space-y-3">
                <SectionTitle>{t('views.calendar.details.tenantInfo')}</SectionTitle>
                <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
                  <Field
                    label={t('views.calendar.details.tenant')}
                    value={formatPersonName(detailsContext.tenant.name)}
                  />
                  <Field label={t('views.calendar.details.email')} value={detailsContext.tenant.email || '—'} />
                  <Field label={t('views.calendar.details.phone')} value={detailsContext.tenant.phone || '—'} />
                </dl>
              </section>
            ) : null}

            {detailsContext.contract ? (
              <section className="space-y-3">
                <SectionTitle>{t('views.calendar.details.leaseInfo')}</SectionTitle>
                <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
                  <Field
                    label={t('views.calendar.details.contractNo')}
                    value={detailsContext.contract.contractNo || detailsContext.contract.id}
                  />
                  <Field
                    label={t('views.calendar.details.status')}
                    value={detailsContext.contract.status || '—'}
                  />
                  <div className="sm:col-span-2">
                    <Field
                      label={t('views.calendar.details.leasePeriod')}
                      value={`${formatEventDate(detailsContext.contract.startDate)} – ${formatEventDate(detailsContext.contract.endDate)}`}
                    />
                  </div>
                  <Field
                    label={t('views.calendar.details.monthlyRent')}
                    value={formatPhp(detailsContext.contract.monthlyRent)}
                  />
                  <Field
                    label={t('views.calendar.details.securityDeposit')}
                    value={formatPhp(detailsContext.contract.securityDeposit)}
                  />
                  <Field
                    label={t('views.calendar.details.advanceRent')}
                    value={formatPhp(detailsContext.contract.advanceRent)}
                  />
                  {detailsContext.contract.agentName ? (
                    <Field
                      label={t('views.calendar.details.agent')}
                      value={formatPersonName(detailsContext.contract.agentName)}
                    />
                  ) : null}
                </dl>
              </section>
            ) : null}

            {detailsContext.payment ? (
              <section className="space-y-3">
                <SectionTitle>{t('views.calendar.details.paymentInfo')}</SectionTitle>
                <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
                  <Field
                    label={t('views.calendar.details.amount')}
                    value={formatPhp(detailsContext.payment.amount)}
                  />
                  <Field
                    label={t('views.calendar.details.status')}
                    value={detailsContext.payment.status || '—'}
                  />
                  <Field
                    label={t('views.calendar.details.dueDate')}
                    value={formatEventDate(detailsContext.payment.dueDate)}
                  />
                  <Field
                    label={t('views.calendar.details.paidDate')}
                    value={formatEventDate(detailsContext.payment.paidDate)}
                  />
                </dl>
              </section>
            ) : null}

            {!detailsContext.unit && !detailsContext.contract && !detailsContext.payment ? (
              <p className="text-sm text-slate-500">{t('views.calendar.details.noLinkedData')}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
