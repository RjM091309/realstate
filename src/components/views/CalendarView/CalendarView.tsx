import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Info,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

/** Soft chip styles for calendar day pills (icons keep solid `color` classes). */
function eventChipClass(color: string): string {
  if (color.includes('emerald')) {
    return 'bg-emerald-100 text-emerald-800 border-l-emerald-500 dark:bg-emerald-500/25 dark:text-emerald-200 dark:border-l-emerald-400';
  }
  if (color.includes('rose')) {
    return 'bg-rose-100 text-rose-800 border-l-rose-500 dark:bg-rose-500/25 dark:text-rose-200 dark:border-l-rose-400';
  }
  if (color.includes('blue')) {
    return 'bg-blue-100 text-blue-800 border-l-blue-500 dark:bg-blue-500/25 dark:text-blue-200 dark:border-l-blue-400';
  }
  if (color.includes('amber')) {
    return 'bg-amber-100 text-amber-900 border-l-amber-500 dark:bg-amber-500/25 dark:text-amber-200 dark:border-l-amber-400';
  }
  if (color.includes('indigo')) {
    return 'bg-indigo-100 text-indigo-800 border-l-indigo-500 dark:bg-indigo-500/25 dark:text-indigo-200 dark:border-l-indigo-400';
  }
  return 'bg-slate-100 text-slate-700 border-l-slate-400 dark:bg-slate-700/50 dark:text-slate-200 dark:border-l-slate-400';
}

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
      const raw = ev.raw;
      const unitIdFromContract =
        raw.contractId != null ? contracts.find((c) => c.id === raw.contractId)?.unitId : undefined;
      const unitIdFromPayment =
        raw.paymentScheduleId != null ? payments.find((p) => p.id === raw.paymentScheduleId)?.unitId : undefined;
      const unitIdFromMeta =
        raw.metadata && typeof raw.metadata === 'object' && raw.metadata !== null && 'unitId' in raw.metadata
          ? String((raw.metadata as { unitId?: string }).unitId ?? '').trim()
          : '';
      const unitId = unitIdFromContract ?? unitIdFromPayment ?? unitIdFromMeta ?? units[0]?.id ?? '';
      setEventFormMode('edit');
      setEditingEventId(raw.id);
      setEventForm({
        eventType: raw.eventType,
        eventDate: raw.eventDate,
        title: raw.title,
        unitId,
        colorCode: raw.colorCode ?? '',
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
      const raw = ev.raw;
      if (!window.confirm(t('views.calendar.deleteConfirm', { title: raw.title }))) return;
      try {
        await deleteCalendarEvent(raw.id);
        setCustomEvents((prev) => prev.filter((e) => e.id !== raw.id));
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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{t('views.calendar.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('views.calendar.subtitle')}</p>
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
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                const today = new Date();
                setCurrentMonth(today);
                setSelectedDay(today);
              }} 
              className="h-8 px-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
            >
              {t('views.calendar.today')}
            </Button>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-4 font-bold text-sm min-w-[140px] text-center text-slate-700 dark:text-slate-200">
              {format(currentMonth, 'MMMM yyyy')}
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-xl shadow-slate-200/50 dark:shadow-black/50 overflow-hidden bg-slate-200/70 dark:bg-slate-900/90 backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b border-slate-300/60 dark:border-slate-800 bg-slate-200/80 dark:bg-slate-900/70">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="p-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-300/50 border-b border-slate-300/50 bg-slate-200/60 dark:divide-slate-800 dark:border-slate-800 dark:bg-transparent">
            {calendarGridDays.map((day) => {
              const dayEvents = events.filter((e) => isSameDay(e.date, day));
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTday = isToday(day);

              return (
                <div
                  key={day.toString()}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "min-h-[100px] p-2 cursor-pointer transition-all duration-200 relative group",
                    !isCurrentMonth
                      ? "bg-slate-100/80 text-slate-400 dark:bg-slate-950/40 dark:text-slate-600"
                      : "bg-white text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300 dark:shadow-none",
                    isSelected
                      ? "bg-slate-200 ring-2 ring-inset ring-indigo-500/40 shadow-md dark:bg-indigo-500/10 dark:ring-1 dark:ring-indigo-500/20 dark:ring-indigo-400/25 dark:shadow-none z-10"
                      : "hover:bg-white/90 dark:hover:bg-slate-800/50"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={cn(
                      "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg transition-all",
                      isTday
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-950/60"
                        : isSelected
                          ? "text-indigo-700 bg-slate-300/60 dark:text-indigo-300 dark:bg-indigo-500/20"
                          : "text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold border-none">
                        {dayEvents.length}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1 mt-2">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded-md border-l-2 truncate flex items-center gap-1 font-semibold',
                          !ev.colorHex && eventChipClass(ev.color || 'bg-slate-500'),
                        )}
                        style={
                          ev.colorHex
                            ? {
                                backgroundColor: `${ev.colorHex}33`,
                                color: ev.colorHex,
                                borderLeftColor: ev.colorHex,
                              }
                            : undefined
                        }
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                        <span className="truncate">{ev.typeLabel}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold pl-1">
                        +{dayEvents.length - 3} {t('views.calendar.more', 'more')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-md dark:shadow-black/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('views.calendar.dailySchedule')}</CardTitle>
                <CardDescription className="text-xs font-medium mt-0.5 text-slate-500 dark:text-slate-400">
                  {selectedDay ? format(selectedDay, 'MMMM dd, yyyy') : t('views.calendar.selectDate')}
                </CardDescription>
              </div>
              {selectedDay && isToday(selectedDay) && (
                <Badge className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 shadow-sm dark:shadow-none border-none px-3 py-1 text-xs font-bold uppercase tracking-wider">{t('views.calendar.today')}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {selectedDayEvents.length > 0 ? (
                selectedDayEvents.map((event) => {
                  const unit = units.find((u) => u.id === event.unitId);
                  return (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 group hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-inner",
                            !event.colorHex && (event.color || 'bg-indigo-600'),
                          )}
                          style={event.colorHex ? { backgroundColor: event.colorHex } : undefined}
                        >
                          {React.isValidElement(event.icon)
                            ? React.cloneElement(event.icon as React.ReactElement<any>, { className: "w-3 h-3 drop-shadow-sm" })
                            : event.icon}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">{event.typeLabel}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{t('views.calendar.unitLabel', { unitNumber: unit?.unitNumber })} • {unit?.buildingName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 transition-opacity">
                        {event.source === 'custom' && canUpdate ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 font-medium"
                            onClick={() => openEditEvent(event)}
                          >
                            <Pencil className="w-4 h-4 mr-1.5" />
                            {t('views.calendar.edit')}
                          </Button>
                        ) : null}
                        {event.source === 'custom' && canDelete ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-medium"
                            onClick={() => void removeEvent(event)}
                          >
                            <Trash2 className="w-4 h-4 mr-1.5" />
                            {t('views.calendar.delete')}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                          onClick={() => openDetails(event)}
                        >
                          {t('views.calendar.viewDetails')}
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                  <CalendarIcon className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm italic">{t('views.calendar.noEvents')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md dark:shadow-black/30">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2 dark:text-slate-100">
              <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {t('views.calendar.timelineLegend')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('views.calendar.moveIn')}</span>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('views.calendar.moveOut')}</span>
                </div>
                <ArrowLeft className="w-3 h-3 text-slate-300 dark:text-slate-600" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('views.calendar.paymentPaid')}</span>
                </div>
                <DollarSign className="w-3 h-3 text-slate-300 dark:text-slate-600" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('views.calendar.paymentPending')}</span>
                </div>
                <DollarSign className="w-3 h-3 text-slate-300 dark:text-slate-600" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                {t('views.calendar.infoText')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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
