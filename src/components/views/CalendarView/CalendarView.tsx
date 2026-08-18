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
  Wrench,
  ClipboardCheck,
  Eye,
  Clock,
  List as ListIcon,
  LayoutGrid,
  CalendarRange,
  CalendarDays,
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
  isSameMonth,
  addDays,
  subDays,
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
import { fetchMaintenanceRequests, type MaintenanceRequestRow } from '@/lib/specialRequestsApi';
import { fetchInspectionsForCalendar, type InspectionCalendarRow } from '@/lib/unitInspectionApi';
import {
  createPropertyViewing,
  deletePropertyViewing,
  fetchPropertyViewings,
  updatePropertyViewing,
  type PropertyViewing,
} from '@/lib/propertyViewingsApi';
import { StatusBadge } from '@/components/status-badge';
import { contractStatusVariant, paymentStatusVariant } from '@/lib/statusBadge';
import type { Contract, Payment, Tenant, Unit } from '@/types';
import { Modal } from '@/components/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select2 } from '@/components/select2';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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
      <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium leading-snug text-slate-900 dark:text-slate-100">
        {value ?? '—'}
      </dd>
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

function DetailCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60',
        className,
      )}
    >
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function yearRentTotal(monthlyRent: number | null | undefined): number {
  const n = Number(monthlyRent);
  return Number.isFinite(n) && n > 0 ? n * 12 : 0;
}

/** Canonical key used by the filter bar; distinct from `typeLabel` (display text). */
type EventFilterKey =
  | 'move_in'
  | 'move_out'
  | 'lease_expiration'
  | 'payment'
  | 'maintenance'
  | 'inspection'
  | 'property_viewing'
  | 'other';

const ALL_FILTER_KEYS: EventFilterKey[] = [
  'move_in',
  'move_out',
  'lease_expiration',
  'payment',
  'maintenance',
  'inspection',
  'property_viewing',
  'other',
];

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
  filterKey: EventFilterKey;
  raw?: CalendarEvent;
  /** Present only for auto-generated Property Viewing events — these ARE editable/deletable. */
  viewingRaw?: PropertyViewing;
  /** Present only for auto-generated Maintenance events — read-only, managed from Maintenance Monitoring. */
  maintenanceRaw?: MaintenanceRequestRow;
  /** Present only for auto-generated (real) Inspection events — read-only, managed from the contract's inspection flow. */
  inspectionRaw?: InspectionCalendarRow;
  contractId?: string | null;
  paymentId?: string | null;
};

function eventAccent(ev: Pick<UiEvent, 'color' | 'colorHex'>): string {
  if (ev.colorHex) return ev.colorHex;
  if (ev.color.includes('emerald')) return '#10b981';
  if (ev.color.includes('rose')) return '#f43f5e';
  if (ev.color.includes('blue')) return '#3b82f6';
  if (ev.color.includes('amber')) return '#f59e0b';
  if (ev.color.includes('indigo')) return '#4B89CD';
  if (ev.color.includes('orange')) return '#f97316';
  if (ev.color.includes('red')) return '#ef4444';
  if (ev.color.includes('purple')) return '#a855f7';
  return '#64748b';
}

const CALENDAR_FORM_INPUT =
  'h-12 rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:border-brand-blue focus-visible:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-950/80';

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
    return 'bg-brand-blue/10 text-brand-blue border-l-brand-blue dark:bg-brand-blue/25 dark:text-blue-200 dark:border-l-brand-blue';
  }
  if (color.includes('orange')) {
    return 'bg-orange-100 text-orange-800 border-l-orange-500 dark:bg-orange-500/25 dark:text-orange-200 dark:border-l-orange-400';
  }
  if (color.includes('red')) {
    return 'bg-red-100 text-red-800 border-l-red-500 dark:bg-red-500/25 dark:text-red-200 dark:border-l-red-400';
  }
  if (color.includes('purple')) {
    return 'bg-purple-100 text-purple-800 border-l-purple-500 dark:bg-purple-500/25 dark:text-purple-200 dark:border-l-purple-400';
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

/** Broader than `CalendarEventType` — the form also supports creating a Property Viewing,
 *  which is backed by its own `property_viewing` table/API rather than `calendar_event`. */
type CalendarFormEventType = CalendarEventType | 'property_viewing';

type EventForm = {
  eventType: CalendarFormEventType;
  eventDate: string;
  eventTime: string;
  title: string;
  unitId: string;
  colorCode: string;
  prospectContact: string;
};

function defaultEventForm(today: Date, unitId: string): EventForm {
  return {
    eventType: 'inspection',
    eventDate: format(today, 'yyyy-MM-dd'),
    eventTime: '',
    title: 'Inspection',
    unitId,
    colorCode: '#4B89CD',
    prospectContact: '',
  };
}

export function CalendarView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequestRow[]>([]);
  const [inspections, setInspections] = useState<InspectionCalendarRow[]>([]);
  const [propertyViewings, setPropertyViewings] = useState<PropertyViewing[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'list'>('month');
  const [activeFilters, setActiveFilters] = useState<Set<EventFilterKey>>(() => new Set(ALL_FILTER_KEYS));

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventFormMode, setEventFormMode] = useState<'create' | 'edit'>('create');
  const [editingKind, setEditingKind] = useState<'calendar_event' | 'property_viewing'>('calendar_event');
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
        try {
          setMaintenanceRequests(await fetchMaintenanceRequests());
        } catch {
          hadError = true;
          setMaintenanceRequests([]);
        }
        try {
          setInspections(await fetchInspectionsForCalendar());
        } catch {
          hadError = true;
          setInspections([]);
        }
        try {
          setPropertyViewings(await fetchPropertyViewings());
        } catch {
          hadError = true;
          setPropertyViewings([]);
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
        filterKey: 'move_in' as const,
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
        filterKey: 'move_out' as const,
        contractId: c.id,
      })),
      ...contracts
        .filter((c) => c.status === 'Active')
        .map((c) => ({
          id: `lease-exp-${c.id}`,
          date: startOfDay(parseISO(c.endDate)),
          typeLabel: t('views.calendar.eventTypes.leaseExpiration'),
          unitId: c.unitId,
          color: 'bg-orange-500',
          icon: <Clock className="w-3 h-3" />,
          source: 'derived' as const,
          filterKey: 'lease_expiration' as const,
          contractId: c.id,
        })),
      ...payments.map((p) => ({
        id: `payment-due-${p.id}`,
        date: startOfDay(parseISO(p.dueDate)),
        typeLabel:
          p.status === 'Paid'
            ? t('views.calendar.paymentPaid')
            : t('views.calendar.eventTypes.paymentDue'),
        unitId: p.unitId,
        color: p.status === 'Paid' ? 'bg-blue-500' : 'bg-amber-500',
        icon: <DollarSign className="w-3 h-3" />,
        source: 'derived' as const,
        filterKey: 'payment' as const,
        contractId: p.contractId,
        paymentId: p.id,
      })),
      ...maintenanceRequests
        .filter((r) => !!r.scheduledDate)
        .map((r) => {
          const contract = contracts.find((c) => c.id === r.contractId);
          return {
            id: `maintenance-${r.id}`,
            date: startOfDay(parseISO(String(r.scheduledDate))),
            typeLabel: t('views.calendar.eventTypes.maintenance'),
            unitId: contract?.unitId ?? '',
            color: 'bg-red-500',
            icon: <Wrench className="w-3 h-3" />,
            source: 'derived' as const,
            filterKey: 'maintenance' as const,
            contractId: r.contractId,
            maintenanceRaw: r,
          };
        }),
      ...inspections.map((row) => ({
        id: `auto-inspection-${row.id}`,
        date: startOfDay(parseISO(String(row.scheduledDate))),
        typeLabel: t('views.calendar.eventTypes.inspection'),
        unitId: row.unitId,
        color: 'bg-brand-blue',
        icon: <ClipboardCheck className="w-3 h-3" />,
        source: 'derived' as const,
        filterKey: 'inspection' as const,
        contractId: row.contractId,
        inspectionRaw: row,
      })),
      ...propertyViewings.map((v) => ({
        id: `viewing-${v.id}`,
        date: startOfDay(parseISO(v.scheduledAt.slice(0, 10))),
        typeLabel: t('views.calendar.eventTypes.propertyViewing'),
        unitId: v.unitId,
        color: 'bg-purple-500',
        icon: <Eye className="w-3 h-3" />,
        source: 'derived' as const,
        filterKey: 'property_viewing' as const,
        viewingRaw: v,
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
            ? 'bg-brand-blue'
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

      const filterKey: EventFilterKey =
        e.eventType === 'move_in'
          ? 'move_in'
          : e.eventType === 'move_out'
            ? 'move_out'
            : e.eventType === 'payment_due' || e.eventType === 'payment_received'
              ? 'payment'
              : e.eventType === 'inspection'
                ? 'inspection'
                : 'other';

      return {
        id: `custom-${e.id}`,
        date,
        typeLabel: e.title || label,
        unitId,
        color,
        colorHex: hex,
        icon,
        source: 'custom' as const,
        filterKey,
        raw: e,
        contractId: e.contractId,
      };
    });

    return [...derived, ...custom].filter((ev) => ev.unitId);
  }, [contracts, customEvents, inspections, maintenanceRequests, payments, propertyViewings, t]);

  const filteredEvents = useMemo(
    () => events.filter((e) => activeFilters.has(e.filterKey)),
    [events, activeFilters],
  );

  const unitOptions = useMemo(
    () => units.map((u) => ({ value: u.id, label: `${u.unitNumber} - ${u.buildingName}` })),
    [units],
  );

  const eventTypeOptions = useMemo(() => {
    const base = [
      { value: 'inspection', label: t('views.calendar.eventTypes.inspection') },
      { value: 'other', label: t('views.calendar.eventTypes.other') },
      { value: 'move_in', label: t('views.calendar.eventTypes.moveIn') },
      { value: 'move_out', label: t('views.calendar.eventTypes.moveOut') },
      { value: 'payment_due', label: t('views.calendar.eventTypes.paymentDue') },
      { value: 'payment_received', label: t('views.calendar.eventTypes.paymentReceived') },
    ];
    // Property Viewing is backed by its own table — only offerable when not converting
    // an existing calendar_event (type conversion between the two tables isn't supported).
    if (eventFormMode === 'create' || editingKind === 'property_viewing') {
      base.push({ value: 'property_viewing', label: t('views.calendar.eventTypes.propertyViewing') });
    }
    return base;
  }, [editingKind, eventFormMode, t]);

  const isPropertyViewingForm = eventForm.eventType === 'property_viewing';

  const openCreateEvent = useCallback(() => {
    const day = selectedDay ?? new Date();
    const fallbackUnit = units[0]?.id ?? '';
    setEventFormMode('create');
    setEditingKind('calendar_event');
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
      if (ev.filterKey === 'property_viewing' && ev.viewingRaw) {
        const v = ev.viewingRaw;
        const [datePart, timePart] = v.scheduledAt.split(' ');
        setEventFormMode('edit');
        setEditingKind('property_viewing');
        setEditingEventId(v.id);
        setEventForm({
          eventType: 'property_viewing',
          eventDate: datePart,
          eventTime: (timePart ?? '').slice(0, 5),
          title: v.prospectName,
          unitId: v.unitId,
          colorCode: '',
          prospectContact: v.prospectContact ?? '',
        });
        setEventModalOpen(true);
        return;
      }
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
      setEditingKind('calendar_event');
      setEditingEventId(raw.id);
      setEventForm({
        eventType: raw.eventType,
        eventDate: raw.eventDate,
        eventTime: '',
        title: raw.title,
        unitId,
        colorCode: raw.colorCode ?? '',
        prospectContact: '',
      });
      setEventModalOpen(true);
    },
    [contracts, payments, units],
  );

  const closeEventModal = useCallback(() => {
    setEventModalOpen(false);
    setEventFormMode('create');
    setEditingKind('calendar_event');
    setEditingEventId(null);
  }, []);

  const saveEvent = useCallback(async () => {
    if (!eventForm.unitId || !eventForm.eventDate || !eventForm.title.trim()) {
      toast.error(t('views.calendar.validationRequired'));
      return;
    }

    if (isPropertyViewingForm) {
      const scheduledAt = eventForm.eventTime
        ? `${eventForm.eventDate} ${eventForm.eventTime}:00`
        : eventForm.eventDate;
      const body = {
        unitId: eventForm.unitId,
        prospectName: eventForm.title.trim(),
        prospectContact: eventForm.prospectContact.trim() || null,
        scheduledAt,
      };
      try {
        if (eventFormMode === 'edit' && editingEventId) {
          const updated = await updatePropertyViewing(editingEventId, body);
          setPropertyViewings((prev) => prev.map((v) => (v.id === editingEventId ? updated : v)));
          toast.success(t('views.calendar.updated'));
        } else {
          const created = await createPropertyViewing(body);
          setPropertyViewings((prev) => [created, ...prev]);
          toast.success(t('views.calendar.created'));
        }
        closeEventModal();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('views.calendar.saveError'));
      }
      return;
    }

    const unit = units.find((u) => u.id === eventForm.unitId);
    const buildingHint = unit ? `${unit.unitNumber} - ${unit.buildingName}` : '';
    const contract = pickContractForCalendarEvent(
      contracts,
      eventForm.unitId,
      eventForm.eventType as CalendarEventType,
      eventForm.eventDate,
    );
    const contractId = contract?.id ?? null;
    const paymentScheduleId =
      findPaymentScheduleForEvent(
        payments,
        eventForm.unitId,
        eventForm.eventDate,
        eventForm.eventType as CalendarEventType,
        contractId,
      ) ?? null;
    const body = {
      eventType: eventForm.eventType as CalendarEventType,
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
  }, [
    closeEventModal,
    contracts,
    editingEventId,
    eventForm,
    eventFormMode,
    isPropertyViewingForm,
    payments,
    t,
    units,
  ]);

  const removeEvent = useCallback(
    async (ev: UiEvent) => {
      if (ev.filterKey === 'property_viewing' && ev.viewingRaw) {
        const viewing = ev.viewingRaw;
        if (!window.confirm(t('views.calendar.deleteConfirm', { title: viewing.prospectName }))) return;
        try {
          await deletePropertyViewing(viewing.id);
          setPropertyViewings((prev) => prev.filter((v) => v.id !== viewing.id));
          toast.success(t('views.calendar.deleted'));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : t('views.calendar.deleteError'));
        }
        return;
      }
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

  const isEventEditable = useCallback(
    (ev: UiEvent) => (ev.source === 'custom' && !!ev.raw) || (ev.filterKey === 'property_viewing' && !!ev.viewingRaw),
    [],
  );

  const openPreview = useCallback((type: 'contract' | 'invoice', id: string) => {
    const url = `${window.location.origin}/preview?type=${type}&id=${encodeURIComponent(id)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const goNext = () => {
    if (viewMode === 'week') {
      const d = addDays(selectedDay ?? currentMonth, 7);
      setSelectedDay(d);
      setCurrentMonth(d);
    } else if (viewMode === 'day') {
      const d = addDays(selectedDay ?? currentMonth, 1);
      setSelectedDay(d);
      setCurrentMonth(d);
    } else {
      setCurrentMonth(addMonths(currentMonth, 1));
    }
  };
  const goPrev = () => {
    if (viewMode === 'week') {
      const d = subDays(selectedDay ?? currentMonth, 7);
      setSelectedDay(d);
      setCurrentMonth(d);
    } else if (viewMode === 'day') {
      const d = subDays(selectedDay ?? currentMonth, 1);
      setSelectedDay(d);
      setCurrentMonth(d);
    } else {
      setCurrentMonth(subMonths(currentMonth, 1));
    }
  };

  const weekDays = useMemo(() => {
    const base = selectedDay ?? currentMonth;
    return eachDayOfInterval({ start: startOfWeek(base), end: endOfWeek(base) });
  }, [selectedDay, currentMonth]);

  const listEvents = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return [...filteredEvents]
      .filter((e) => e.date >= start && e.date <= end)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredEvents, currentMonth]);

  const headerLabel = useMemo(() => {
    if (viewMode === 'week') {
      const start = weekDays[0];
      const end = weekDays[weekDays.length - 1];
      if (!start || !end) return format(currentMonth, 'MMMM yyyy');
      return isSameMonth(start, end)
        ? `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
        : `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    if (viewMode === 'day') {
      return format(selectedDay ?? currentMonth, 'EEEE, MMM d, yyyy');
    }
    return format(currentMonth, 'MMMM yyyy');
  }, [currentMonth, selectedDay, viewMode, weekDays]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return filteredEvents.filter((e) => isSameDay(e.date, selectedDay));
  }, [selectedDay, filteredEvents]);

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
              className="h-9 rounded-lg bg-brand-blue px-3 text-sm text-white hover:bg-[#3d7ab8]"
              onClick={openCreateEvent}
              disabled={loading}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t('views.calendar.addEvent')}
            </Button>
          ) : null}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
            {(
              [
                { key: 'month' as const, label: t('views.calendar.viewMode.month'), icon: LayoutGrid },
                { key: 'week' as const, label: t('views.calendar.viewMode.week'), icon: CalendarRange },
                { key: 'day' as const, label: t('views.calendar.viewMode.day'), icon: CalendarDays },
                { key: 'list' as const, label: t('views.calendar.viewMode.list'), icon: ListIcon },
              ]
            ).map((mode) => (
              <Button
                key={mode.key}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewMode(mode.key)}
                className={cn(
                  'h-8 px-2.5 text-xs font-bold transition-colors',
                  viewMode === mode.key
                    ? 'bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20 dark:text-brand-blue'
                    : 'text-slate-600 dark:text-slate-300 hover:text-brand-blue dark:hover:text-brand-blue hover:bg-brand-blue/10 dark:hover:bg-brand-blue/10',
                )}
              >
                <mode.icon className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{mode.label}</span>
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const today = new Date();
                setCurrentMonth(today);
                setSelectedDay(today);
              }}
              className="h-8 px-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-brand-blue dark:hover:text-brand-blue hover:bg-brand-blue/10 dark:hover:bg-brand-blue/10 transition-colors"
            >
              {t('views.calendar.today')}
            </Button>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            <Button variant="ghost" size="icon" onClick={goPrev} className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-4 font-bold text-sm min-w-[140px] text-center text-slate-700 dark:text-slate-200">
              {headerLabel}
            </div>
            <Button variant="ghost" size="icon" onClick={goNext} className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {viewMode === 'month' ? (
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
                const dayEvents = filteredEvents.filter((e) => isSameDay(e.date, day));
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
                        ? "bg-slate-200 ring-2 ring-inset ring-brand-blue/40 shadow-md dark:bg-brand-blue/10 dark:ring-1 dark:ring-brand-blue/20 dark:ring-brand-blue/25 dark:shadow-none z-10"
                        : "hover:bg-white/90 dark:hover:bg-slate-800/50"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={cn(
                        "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg transition-all",
                        isTday
                          ? "bg-brand-blue text-white shadow-md shadow-brand-blue/20 dark:shadow-brand-blue/40"
                          : isSelected
                            ? "text-brand-blue bg-slate-300/60 dark:text-brand-blue dark:bg-brand-blue/20"
                            : "text-slate-500 dark:text-slate-400 group-hover:text-brand-blue dark:group-hover:text-brand-blue"
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
      ) : null}

      {viewMode === 'week' ? (
        <Card className="border-none shadow-xl shadow-slate-200/50 dark:shadow-black/50 overflow-hidden bg-slate-200/70 dark:bg-slate-900/90 backdrop-blur-sm">
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b border-slate-300/60 dark:border-slate-800 bg-slate-200/80 dark:bg-slate-900/70">
              {weekDays.map((d) => (
                <div key={d.toString()} className="p-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {format(d, 'EEE')}
                  </div>
                  <div className={cn('mt-0.5 text-xs font-bold', isToday(d) ? 'text-brand-blue' : 'text-slate-600 dark:text-slate-300')}>
                    {format(d, 'd')}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-slate-300/50 dark:divide-slate-800">
              {weekDays.map((day) => {
                const dayEvents = filteredEvents.filter((e) => isSameDay(e.date, day));
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                return (
                  <div
                    key={day.toString()}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      'min-h-[220px] p-2 cursor-pointer transition-all duration-200',
                      isSelected
                        ? 'bg-slate-200 ring-2 ring-inset ring-brand-blue/40 dark:bg-brand-blue/10 dark:ring-1 dark:ring-brand-blue/25'
                        : 'bg-white hover:bg-white/90 dark:bg-slate-900 dark:hover:bg-slate-800/50',
                    )}
                  >
                    <div className="space-y-1">
                      {dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className={cn(
                            'text-[10px] px-2 py-1 rounded-md border-l-2 truncate flex items-center gap-1 font-semibold',
                            !ev.colorHex && eventChipClass(ev.color || 'bg-slate-500'),
                          )}
                          style={
                            ev.colorHex
                              ? { backgroundColor: `${ev.colorHex}33`, color: ev.colorHex, borderLeftColor: ev.colorHex }
                              : undefined
                          }
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                          <span className="truncate">{ev.typeLabel}</span>
                        </div>
                      ))}
                      {dayEvents.length === 0 && (
                        <p className="text-[10px] text-slate-300 dark:text-slate-600 italic pt-2 text-center">—</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {viewMode === 'list' ? (
        <Card className="border-none shadow-md dark:shadow-black/30">
          <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
            {listEvents.length > 0 ? (
              listEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => {
                    setSelectedDay(ev.date);
                    openDetails(ev);
                  }}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="w-20 shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">
                    {format(ev.date, 'MMM d')}
                  </div>
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0',
                      !ev.colorHex && (ev.color || 'bg-slate-500'),
                    )}
                    style={ev.colorHex ? { backgroundColor: ev.colorHex } : undefined}
                  >
                    {ev.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{ev.typeLabel}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {units.find((u) => u.id === ev.unitId)?.unitNumber ?? '—'} · {units.find((u) => u.id === ev.unitId)?.buildingName ?? ''}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                <ListIcon className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm italic">{t('views.calendar.listEmpty')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

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
                <Badge className="bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-brand-blue hover:bg-brand-blue/20 dark:hover:bg-brand-blue/30 shadow-sm dark:shadow-none border-none px-3 py-1 text-xs font-bold uppercase tracking-wider">{t('views.calendar.today')}</Badge>
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
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 group hover:border-brand-blue/20 dark:hover:border-brand-blue/30 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-inner",
                            !event.colorHex && (event.color || 'bg-brand-blue'),
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
                        {isEventEditable(event) && canUpdate ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-brand-blue dark:text-brand-blue hover:text-brand-blue dark:hover:text-brand-blue hover:bg-brand-blue/10 dark:hover:bg-brand-blue/10 font-medium"
                            onClick={() => openEditEvent(event)}
                          >
                            <Pencil className="w-4 h-4 mr-1.5" />
                            {t('views.calendar.edit')}
                          </Button>
                        ) : null}
                        {isEventEditable(event) && canDelete ? (
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
              <Info className="w-4 h-4 text-brand-blue dark:text-brand-blue" />
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
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('views.calendar.eventTypes.leaseExpiration')}</span>
                </div>
                <Clock className="w-3 h-3 text-slate-300 dark:text-slate-600" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('views.calendar.eventTypes.maintenance')}</span>
                </div>
                <Wrench className="w-3 h-3 text-slate-300 dark:text-slate-600" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-brand-blue"></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('views.calendar.eventTypes.inspection')}</span>
                </div>
                <ClipboardCheck className="w-3 h-3 text-slate-300 dark:text-slate-600" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('views.calendar.eventTypes.propertyViewing')}</span>
                </div>
                <Eye className="w-3 h-3 text-slate-300 dark:text-slate-600" />
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
            <Label>{isPropertyViewingForm ? t('views.calendar.prospectName') : t('views.calendar.eventTitle')}</Label>
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
                onChange={(v) => setEventForm((p) => ({ ...p, eventType: (v ?? 'other') as CalendarFormEventType }))}
              />
            </div>
          </div>
          {isPropertyViewingForm ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
              <div className="min-w-0 space-y-1.5">
                <Label>{t('views.calendar.viewingTime')}</Label>
                <Input
                  type="time"
                  className={cn(CALENDAR_FORM_INPUT, 'w-full')}
                  value={eventForm.eventTime}
                  onChange={(e) => setEventForm((p) => ({ ...p, eventTime: e.target.value }))}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label>{t('views.calendar.prospectContact')}</Label>
                <Input
                  className={CALENDAR_FORM_INPUT}
                  value={eventForm.prospectContact}
                  onChange={(e) => setEventForm((p) => ({ ...p, prospectContact: e.target.value }))}
                />
              </div>
            </div>
          ) : null}
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
          {!isPropertyViewingForm ? (
            <div className="space-y-1.5">
              <Label>{t('views.calendar.color')}</Label>
              <Input
                className={CALENDAR_FORM_INPUT}
                placeholder="#4B89CD"
                value={eventForm.colorCode}
                onChange={(e) => setEventForm((p) => ({ ...p, colorCode: e.target.value }))}
              />
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={detailsOpen}
        onClose={closeDetails}
        title={t('views.calendar.viewDetails')}
        maxWidth="3xl"
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
                onClick={() => {
                  const contractId = String(
                    detailsEvent?.contractId || detailsContext?.contract?.id || '',
                  );
                  const paymentId = String(
                    detailsEvent?.paymentId || detailsContext?.payment?.id || '',
                  );
                  const params = new URLSearchParams();
                  if (contractId) params.set('contractId', contractId);
                  if (paymentId) params.set('paymentId', paymentId);
                  closeDetails();
                  navigate(`/ledger?${params.toString()}`);
                }}
              >
                {t('views.calendar.processPayment')}
              </Button>
            ) : null}
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
            {detailsEvent && isEventEditable(detailsEvent) && canUpdate ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 px-3 text-sm text-slate-600"
                onClick={() => openEditEvent(detailsEvent)}
              >
                {t('views.calendar.edit')}
              </Button>
            ) : null}
            {detailsEvent && isEventEditable(detailsEvent) && canDelete ? (
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
          <div className="max-h-[min(70vh,36rem)] space-y-4 overflow-y-auto pr-1">
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {detailsEvent.typeLabel}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                {formatEventDate(detailsEvent.date)}
                {' · '}
                {detailsEvent.source === 'custom'
                  ? t('views.calendar.customEvent')
                  : t('views.calendar.systemEvent')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {detailsEvent.viewingRaw ? (
                <DetailCard title={t('views.calendar.details.viewingInfo')} className="sm:col-span-2">
                  <Field
                    label={t('views.calendar.details.prospect')}
                    value={detailsEvent.viewingRaw.prospectName}
                  />
                  <Field
                    label={t('views.calendar.details.phone')}
                    value={detailsEvent.viewingRaw.prospectContact || '—'}
                  />
                  <Field
                    label={t('views.calendar.details.status')}
                    value={
                      <StatusBadge
                        tone={
                          detailsEvent.viewingRaw.status === 'completed'
                            ? 'success'
                            : detailsEvent.viewingRaw.status === 'cancelled' ||
                                detailsEvent.viewingRaw.status === 'no_show'
                              ? 'neutral'
                              : 'info'
                        }
                      >
                        {detailsEvent.viewingRaw.status}
                      </StatusBadge>
                    }
                  />
                  <Field label={t('views.calendar.details.agent')} value={detailsEvent.viewingRaw.agentName || '—'} />
                  {detailsEvent.viewingRaw.notes ? (
                    <div className="sm:col-span-2">
                      <Field label={t('views.calendar.details.remarks')} value={detailsEvent.viewingRaw.notes} />
                    </div>
                  ) : null}
                </DetailCard>
              ) : null}

              {detailsEvent.maintenanceRaw ? (
                <DetailCard title={t('views.calendar.details.maintenanceInfo')} className="sm:col-span-2">
                  <Field label={t('views.calendar.details.maintenanceTitle')} value={detailsEvent.maintenanceRaw.title} />
                  <Field
                    label={t('views.calendar.details.status')}
                    value={String(detailsEvent.maintenanceRaw.status).replace('_', ' ')}
                  />
                  <div className="sm:col-span-2">
                    <Field label={t('views.calendar.details.remarks')} value={detailsEvent.maintenanceRaw.details || '—'} />
                  </div>
                </DetailCard>
              ) : null}

              {detailsEvent.inspectionRaw ? (
                <DetailCard title={t('views.calendar.details.inspectionInfo')} className="sm:col-span-2">
                  <Field
                    label={t('views.calendar.details.status')}
                    value={String(detailsEvent.inspectionRaw.status).replace(/_/g, ' ')}
                  />
                  <Field label={t('views.calendar.details.contractNo')} value={detailsEvent.inspectionRaw.contractNo || '—'} />
                </DetailCard>
              ) : null}

              {detailsContext.tenant ? (
                <DetailCard title={t('views.calendar.details.tenantInfo')}>
                  <Field
                    label={t('views.calendar.details.tenant')}
                    value={formatPersonName(detailsContext.tenant.name)}
                  />
                  <Field
                    label={t('views.calendar.details.phone')}
                    value={detailsContext.tenant.phone || '—'}
                  />
                  <div className="sm:col-span-2">
                    <Field
                      label={t('views.calendar.details.email')}
                      value={
                        detailsContext.tenant.email ? (
                          <span className="break-all">{detailsContext.tenant.email}</span>
                        ) : (
                          '—'
                        )
                      }
                    />
                  </div>
                </DetailCard>
              ) : null}

              {detailsContext.unit ? (
                <DetailCard title={t('views.calendar.details.unitInfo')}>
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
                    value={
                      detailsContext.unit.status ? (
                        <StatusBadge
                          tone={
                            detailsContext.unit.status === 'Occupied'
                              ? 'success'
                              : detailsContext.unit.status === 'Available'
                                ? 'info'
                                : 'neutral'
                          }
                        >
                          {detailsContext.unit.status}
                        </StatusBadge>
                      ) : (
                        '—'
                      )
                    }
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
                  {!detailsContext.contract ? (
                    <Field
                      label={t('views.calendar.details.monthlyRate')}
                      value={formatPhp(detailsContext.unit.monthlyRate)}
                    />
                  ) : null}
                </DetailCard>
              ) : null}

              {detailsContext.contract ? (
                <DetailCard
                  title={t('views.calendar.details.leaseInfo')}
                  className={detailsContext.payment ? undefined : 'sm:col-span-2'}
                >
                  <Field
                    label={t('views.calendar.details.contractNo')}
                    value={
                      <span className="font-mono text-xs uppercase tracking-wide">
                        {detailsContext.contract.contractNo || detailsContext.contract.id}
                      </span>
                    }
                  />
                  <Field
                    label={t('views.calendar.details.status')}
                    value={
                      detailsContext.contract.status ? (
                        <StatusBadge tone={contractStatusVariant(detailsContext.contract.status)}>
                          {detailsContext.contract.status}
                        </StatusBadge>
                      ) : (
                        '—'
                      )
                    }
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
                    label={t('views.calendar.details.yearTotal')}
                    value={
                      <span className="font-semibold tabular-nums">
                        {formatPhp(yearRentTotal(detailsContext.contract.monthlyRent))}
                      </span>
                    }
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
                </DetailCard>
              ) : null}

              {detailsContext.payment ? (
                <DetailCard title={t('views.calendar.details.paymentInfo')}>
                  <Field
                    label={t('views.calendar.details.amount')}
                    value={
                      <span className="font-semibold tabular-nums">
                        {formatPhp(detailsContext.payment.amount)}
                      </span>
                    }
                  />
                  <Field
                    label={t('views.calendar.details.status')}
                    value={
                      detailsContext.payment.status ? (
                        <StatusBadge tone={paymentStatusVariant(detailsContext.payment.status)}>
                          {detailsContext.payment.status}
                        </StatusBadge>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <Field
                    label={t('views.calendar.details.dueDate')}
                    value={formatEventDate(detailsContext.payment.dueDate)}
                  />
                  <Field
                    label={t('views.calendar.details.paidDate')}
                    value={formatEventDate(detailsContext.payment.paidDate)}
                  />
                  {(detailsEvent?.contractId || detailsContext?.contract?.id) ? (
                    <div className="sm:col-span-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        className={`${modalOutlineButtonClass} w-full`}
                        onClick={() => {
                          const contractId = String(
                            detailsEvent?.contractId || detailsContext?.contract?.id || '',
                          );
                          const paymentId = String(
                            detailsEvent?.paymentId || detailsContext?.payment?.id || '',
                          );
                          const params = new URLSearchParams();
                          if (contractId) params.set('contractId', contractId);
                          if (paymentId) params.set('paymentId', paymentId);
                          closeDetails();
                          navigate(`/ledger?${params.toString()}`);
                        }}
                      >
                        {t('views.calendar.processPayment')}
                      </Button>
                    </div>
                  ) : null}
                </DetailCard>
              ) : null}
            </div>

            {!detailsContext.unit && !detailsContext.contract && !detailsContext.payment ? (
              <p className="text-sm text-slate-500">{t('views.calendar.details.noLinkedData')}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
