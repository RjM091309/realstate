import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Info,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Home,
  Plus,
  Trash2,
  Pencil,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  format, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  startOfDay,
  parseISO
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { fetchUnits } from '@/lib/unitsApi';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchPayments } from '@/lib/paymentsApi';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  updateCalendarEvent,
  type CalendarEvent,
  type CalendarEventType,
} from '@/lib/calendarEventsApi';
import type { Contract, Payment, Unit } from '@/types';
import { Modal } from '@/components/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select2 } from '@/components/select2';
import { toast } from 'sonner';

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
    const url = `${window.location.origin}${window.location.pathname}?view=preview&type=${type}&id=${encodeURIComponent(id)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return events.filter((e) => isSameDay(e.date, selectedDay));
  }, [selectedDay, events]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('views.calendar.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('views.calendar.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate ? (
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openCreateEvent} disabled={loading}>
              <Plus className="w-4 h-4 mr-2" />
              {t('views.calendar.addEvent')}
            </Button>
          ) : null}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-4 font-bold text-sm min-w-[140px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
            <ChevronRight className="w-4 h-4" />
          </Button>
          </div>
        </div>
      </div>

      <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
        <CardContent className="p-0">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="inline-block min-w-full">
              {/* Timeline Header */}
              <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/60">
                <div className="sticky left-0 z-20 w-48 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 font-bold text-xs text-slate-500 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Home className="w-3 h-3" />
                  {t('views.calendar.units')}
                </div>
                {daysInMonth.map((day) => (
                  <div 
                    key={day.toString()} 
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "flex-shrink-0 w-12 h-16 flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-800 cursor-pointer transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-500/15",
                      isToday(day) && "bg-indigo-50/50 dark:bg-indigo-500/10",
                      selectedDay && isSameDay(day, selectedDay) && "bg-indigo-600 text-white hover:bg-indigo-600"
                    )}
                  >
                    <span className={cn("text-[10px] uppercase font-bold", selectedDay && isSameDay(day, selectedDay) ? "text-indigo-100" : "text-slate-400 dark:text-slate-500")}>
                      {format(day, 'EEE')}
                    </span>
                    <span className="text-sm font-bold">
                      {format(day, 'd')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Timeline Rows */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {units.map((unit) => (
                  <div key={unit.id} className="flex group">
                    <div className="sticky left-0 z-20 w-48 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold text-xs">
                        {unit.unitNumber}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{t('views.calendar.unitLabel', { unitNumber: unit.unitNumber })}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{unit.buildingName}</span>
                      </div>
                    </div>
                    {daysInMonth.map((day) => {
                      const dayEvents = events.filter((e) => e.unitId === unit.id && isSameDay(e.date, day));
                      return (
                        <div 
                          key={`${unit.id}-${day}`} 
                          onClick={() => setSelectedDay(day)}
                          className={cn(
                            "flex-shrink-0 w-12 h-16 border-r border-slate-100 dark:border-slate-800 flex items-center justify-center gap-0.5 p-1 relative cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                            isToday(day) && "bg-indigo-50/20 dark:bg-indigo-500/10"
                          )}
                        >
                          {dayEvents.map((event) => (
                            <div 
                              key={event.id}
                              className={cn(
                                "w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm",
                                !event.colorHex && (event.color || '')
                              )}
                              style={event.colorHex ? { backgroundColor: event.colorHex } : undefined}
                              title={event.typeLabel}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('views.calendar.dailySchedule')}</CardTitle>
                <CardDescription>
                  {selectedDay ? format(selectedDay, 'MMMM dd, yyyy') : t('views.calendar.selectDate')}
                </CardDescription>
              </div>
              {selectedDay && isToday(selectedDay) && (
                <Badge className="bg-indigo-600">{t('views.calendar.today')}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedDayEvents.length > 0 ? (
                selectedDayEvents.map((event) => {
                  const unit = units.find((u) => u.id === event.unitId);
                  return (
                    <div 
                      key={event.id} 
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 group hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm",
                            !event.colorHex && (event.color || 'bg-indigo-600'),
                          )}
                          style={event.colorHex ? { backgroundColor: event.colorHex } : undefined}
                        >
                          {event.icon}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">{event.typeLabel}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{t('views.calendar.unitLabel', { unitNumber: unit?.unitNumber })} • {unit?.buildingName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {event.source === 'custom' && canUpdate ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-indigo-600"
                            onClick={() => openEditEvent(event)}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            {t('views.calendar.edit')}
                          </Button>
                        ) : null}
                        {event.source === 'custom' && canDelete ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-rose-600"
                            onClick={() => void removeEvent(event)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            {t('views.calendar.delete')}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-indigo-600"
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

        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-600" />
              {t('views.calendar.timelineLegend')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('views.calendar.moveIn')}</span>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-500" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('views.calendar.moveOut')}</span>
                </div>
                <ArrowLeft className="w-3 h-3 text-slate-300 dark:text-slate-500" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('views.calendar.paymentPaid')}</span>
                </div>
                <DollarSign className="w-3 h-3 text-slate-300 dark:text-slate-500" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('views.calendar.paymentPending')}</span>
                </div>
                <DollarSign className="w-3 h-3 text-slate-300 dark:text-slate-500" />
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
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={closeEventModal}>
              {t('views.calendar.cancel')}
            </Button>
            <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void saveEvent()}>
              {eventFormMode === 'edit' ? t('views.calendar.save') : t('views.calendar.create')}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('views.calendar.eventTitle')}</Label>
            <Input
              value={eventForm.title}
              onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.calendar.eventDate')}</Label>
            <Input
              type="date"
              value={eventForm.eventDate}
              onChange={(e) => setEventForm((p) => ({ ...p, eventDate: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.calendar.eventType')}</Label>
            <Select2
              options={eventTypeOptions}
              value={eventForm.eventType}
              onChange={(v) => setEventForm((p) => ({ ...p, eventType: (v ?? 'other') as CalendarEventType }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('views.calendar.unit')}</Label>
            <Select2
              options={unitOptions}
              value={eventForm.unitId}
              onChange={(v) => setEventForm((p) => ({ ...p, unitId: (v ?? '') as string }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('views.calendar.color')}</Label>
            <Input
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
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={closeDetails}>
              {t('views.calendar.cancel')}
            </Button>
          </div>
        }
      >
        {detailsEvent ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{detailsEvent.typeLabel}</p>
                <p className="text-xs text-slate-500">
                  {format(detailsEvent.date, 'MMMM dd, yyyy')}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {detailsEvent.source === 'custom' ? t('views.calendar.customEvent') : t('views.calendar.systemEvent')}
              </Badge>
            </div>

            {(() => {
              const unit = units.find((u) => u.id === detailsEvent.unitId);
              return unit ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-500">{t('views.calendar.unit')}</p>
                  <p className="text-sm font-bold text-slate-900">
                    {t('views.calendar.unitLabel', { unitNumber: unit.unitNumber })}
                  </p>
                  <p className="text-xs text-slate-500">{unit.buildingName}</p>
                </div>
              ) : null;
            })()}

            {detailsEvent.source === 'custom' && detailsEvent.raw ? (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1">
                {detailsEvent.raw.contractId ? (
                  <p>
                    <span className="font-semibold text-slate-800">contract_id:</span> {detailsEvent.raw.contractId}
                  </p>
                ) : null}
                {detailsEvent.raw.paymentScheduleId ? (
                  <p>
                    <span className="font-semibold text-slate-800">payment_schedule_id:</span>{' '}
                    {detailsEvent.raw.paymentScheduleId}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {detailsEvent.contractId ? (
                <Button type="button" variant="outline" onClick={() => openPreview('contract', String(detailsEvent.contractId))}>
                  <FileText className="w-4 h-4 mr-2" />
                  {t('views.contracts.table.viewContract')}
                </Button>
              ) : null}
              {detailsEvent.contractId ? (
                <Button type="button" variant="outline" onClick={() => openPreview('invoice', String(detailsEvent.contractId))}>
                  <FileText className="w-4 h-4 mr-2" />
                  {t('views.contracts.table.viewInvoice')}
                </Button>
              ) : null}
              {detailsEvent.source === 'custom' && canUpdate ? (
                <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => openEditEvent(detailsEvent)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  {t('views.calendar.edit')}
                </Button>
              ) : null}
              {detailsEvent.source === 'custom' && canDelete ? (
                <Button type="button" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => void removeEvent(detailsEvent)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('views.calendar.delete')}
                </Button>
              ) : null}
            </div>

            {detailsEvent.source === 'custom' && detailsEvent.raw?.metadata ? (
              <div className="p-4 rounded-xl bg-white border border-slate-100">
                <p className="text-xs font-bold text-slate-600 mb-2">{t('views.calendar.metadata')}</p>
                <pre className="text-[11px] text-slate-600 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(detailsEvent.raw.metadata, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
