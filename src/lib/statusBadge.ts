import { cn } from '@/lib/utils';

/** Shared pill styling for status badges across admin tables and modals. */
export const statusBadgeBase =
  'h-auto rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide border shadow-none';

export const statusBadgeVariants = {
  success:
    'bg-emerald-100 text-emerald-800 border-emerald-300/80 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/40 dark:hover:bg-emerald-500/20',
  warning:
    'bg-amber-100 text-amber-800 border-amber-300/80 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/45 dark:hover:bg-amber-500/20',
  danger:
    'bg-rose-100 text-rose-800 border-rose-300/80 hover:bg-rose-100 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/45 dark:hover:bg-rose-500/20',
  info:
    'bg-brand-blue/10 text-brand-blue border-brand-blue/30 hover:bg-brand-blue/10 dark:bg-brand-blue/20 dark:text-blue-200 dark:border-brand-blue/40 dark:hover:bg-brand-blue/20',
  neutral:
    'bg-slate-100 text-slate-700 border-slate-300/80 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-800/80',
  violet:
    'bg-brand-blue/10 text-brand-blue border-brand-blue/30 hover:bg-brand-blue/10 dark:bg-brand-blue/20 dark:text-blue-100 dark:border-brand-blue/45 dark:hover:bg-brand-blue/25',
  sky:
    'bg-sky-100 text-sky-900 border-sky-300/80 hover:bg-sky-100 dark:bg-sky-500/20 dark:text-sky-100 dark:border-sky-500/45 dark:hover:bg-sky-500/25',
} as const;

export type StatusBadgeVariant = keyof typeof statusBadgeVariants;

export function statusBadgeClass(variant: StatusBadgeVariant, extra?: string): string {
  return cn(statusBadgeBase, statusBadgeVariants[variant], extra);
}

export function paymentStatusVariant(status: string): StatusBadgeVariant {
  const s = status.trim().toLowerCase();
  if (s === 'paid') return 'success';
  if (s === 'overdue') return 'danger';
  return 'warning';
}

export function contractStatusVariant(status: string): StatusBadgeVariant {
  const s = status.trim().toLowerCase();
  if (s === 'active') return 'success';
  if (s === 'expired') return 'danger';
  if (s === 'terminated') return 'neutral';
  if (s.includes('pending')) return 'info';
  return 'neutral';
}

export function inspectionStatusVariant(status: string): StatusBadgeVariant {
  const s = status.trim().toLowerCase();
  if (s === 'ready_for_occupancy' || s === 'occupied') return 'success';
  if (s === 'under_inspection' || s === 'pending_approval') return 'info';
  if (s === 'move_in_scheduled') return 'violet';
  if (s === 'failed') return 'danger';
  if (s === 'vacant') return 'warning';
  return 'neutral';
}

export function leaseRenewalStatusVariant(status: string): StatusBadgeVariant {
  const s = status.trim().toLowerCase();
  if (s === 'active') return 'success';
  if (s === 'ready_to_activate') return 'success';
  if (s === 'awaiting_payment') return 'danger';
  if (s === 'declined') return 'danger';
  if (s === 'pending_signature') return 'violet';
  if (s === 'pending_renewal') return 'info';
  return 'neutral';
}
