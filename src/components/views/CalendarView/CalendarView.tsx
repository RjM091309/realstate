import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Info,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Home
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
  startOfDay
} from 'date-fns';
import { payments, contracts, units } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function CalendarView() {
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const events = useMemo(() => {
    return [
      ...contracts.map(c => ({
        id: `move-in-${c.id}`,
        date: startOfDay(new Date(c.startDate)),
        type: t('views.calendar.eventTypes.moveIn'),
        unitId: c.unitId,
        color: 'bg-emerald-500',
        icon: <ArrowRight className="w-3 h-3" />
      })),
      ...contracts.map(c => ({
        id: `move-out-${c.id}`,
        date: startOfDay(new Date(c.endDate)),
        type: t('views.calendar.eventTypes.moveOut'),
        unitId: c.unitId,
        color: 'bg-rose-500',
        icon: <ArrowLeft className="w-3 h-3" />
      })),
      ...payments.map(p => ({
        id: `payment-${p.id}`,
        date: startOfDay(new Date(p.dueDate)),
        type: t('views.calendar.eventTypes.paymentDue'),
        unitId: p.unitId,
        color: p.status === 'Paid' ? 'bg-emerald-500' : 'bg-amber-500',
        icon: <DollarSign className="w-3 h-3" />
      }))
    ];
  }, [t]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return events.filter(e => isSameDay(e.date, selectedDay));
  }, [selectedDay, events]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.calendar.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.calendar.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
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

      <Card className="border-none shadow-md overflow-hidden">
        <CardContent className="p-0">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="inline-block min-w-full">
              {/* Timeline Header */}
              <div className="flex border-b border-slate-100 bg-slate-50/50">
                <div className="sticky left-0 z-20 w-48 bg-slate-50 border-r border-slate-200 p-4 font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Home className="w-3 h-3" />
                  {t('views.calendar.units')}
                </div>
                {daysInMonth.map((day) => (
                  <div 
                    key={day.toString()} 
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "flex-shrink-0 w-12 h-16 flex flex-col items-center justify-center border-r border-slate-100 cursor-pointer transition-colors hover:bg-indigo-50",
                      isToday(day) && "bg-indigo-50/50",
                      selectedDay && isSameDay(day, selectedDay) && "bg-indigo-600 text-white hover:bg-indigo-600"
                    )}
                  >
                    <span className={cn("text-[10px] uppercase font-bold", selectedDay && isSameDay(day, selectedDay) ? "text-indigo-100" : "text-slate-400")}>
                      {format(day, 'EEE')}
                    </span>
                    <span className="text-sm font-bold">
                      {format(day, 'd')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Timeline Rows */}
              <div className="divide-y divide-slate-100">
                {units.map((unit) => (
                  <div key={unit.id} className="flex group">
                    <div className="sticky left-0 z-20 w-48 bg-white border-r border-slate-200 p-4 flex items-center gap-3 group-hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                        {unit.unitNumber}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-xs font-bold text-slate-900 truncate">{t('views.calendar.unitLabel', { unitNumber: unit.unitNumber })}</span>
                        <span className="text-[10px] text-slate-400 truncate">{unit.buildingName}</span>
                      </div>
                    </div>
                    {daysInMonth.map((day) => {
                      const dayEvents = events.filter(e => e.unitId === unit.id && isSameDay(e.date, day));
                      return (
                        <div 
                          key={`${unit.id}-${day}`} 
                          onClick={() => setSelectedDay(day)}
                          className={cn(
                            "flex-shrink-0 w-12 h-16 border-r border-slate-100 flex items-center justify-center gap-0.5 p-1 relative cursor-pointer hover:bg-slate-50 transition-colors",
                            isToday(day) && "bg-indigo-50/20"
                          )}
                        >
                          {dayEvents.map((event) => (
                            <div 
                              key={event.id}
                              className={cn(
                                "w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm",
                                event.color
                              )}
                              title={event.type}
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
        <Card className="lg:col-span-2 border-none shadow-md">
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
                  const unit = units.find(u => u.id === event.unitId);
                  return (
                    <div 
                      key={event.id} 
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 group hover:border-indigo-200 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm",
                          event.color
                        )}>
                          {event.icon}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{event.type}</p>
                          <p className="text-xs text-slate-500">{t('views.calendar.unitLabel', { unitNumber: unit?.unitNumber })} • {unit?.buildingName}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {t('views.calendar.viewDetails')}
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <CalendarIcon className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm italic">{t('views.calendar.noEvents')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-600" />
              {t('views.calendar.timelineLegend')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-medium text-slate-700">{t('views.calendar.moveIn')}</span>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-300" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className="text-xs font-medium text-slate-700">{t('views.calendar.moveOut')}</span>
                </div>
                <ArrowLeft className="w-3 h-3 text-slate-300" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-medium text-slate-700">{t('views.calendar.paymentPaid')}</span>
                </div>
                <DollarSign className="w-3 h-3 text-slate-300" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-xs font-medium text-slate-700">{t('views.calendar.paymentPending')}</span>
                </div>
                <DollarSign className="w-3 h-3 text-slate-300" />
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {t('views.calendar.infoText')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
