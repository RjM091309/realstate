import { apiFetch } from '@/lib/api';

export type CalendarEventType =
  | 'move_in'
  | 'move_out'
  | 'payment_due'
  | 'payment_received'
  | 'inspection'
  | 'other';

export type CalendarEvent = {
  id: string;
  contractId: string | null;
  paymentScheduleId: string | null;
  eventType: CalendarEventType;
  eventDate: string; // yyyy-MM-dd
  title: string;
  colorCode: string | null;
  metadata?: unknown;
  createdAt?: string;
};

export type CalendarEventWriteBody = {
  contractId?: string | null;
  paymentScheduleId?: string | null;
  eventType: CalendarEventType;
  eventDate: string; // yyyy-MM-dd
  title: string;
  colorCode?: string | null;
  metadata?: unknown;
};

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const { events } = await apiFetch<{ events: CalendarEvent[] }>('/api/calendar-events');
  return events;
}

export async function createCalendarEvent(body: CalendarEventWriteBody): Promise<CalendarEvent> {
  const { event } = await apiFetch<{ event: CalendarEvent }>('/api/calendar-events', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return event;
}

export async function updateCalendarEvent(id: string, body: CalendarEventWriteBody): Promise<CalendarEvent> {
  const { event } = await apiFetch<{ event: CalendarEvent }>(`/api/calendar-events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return event;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/calendar-events/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

