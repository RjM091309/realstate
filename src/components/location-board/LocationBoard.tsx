import React from 'react';
import { cn } from '@/lib/utils';

/** Drill-down board panels (LINE / AGENT / GUEST style) — neutral Realstate colors. */
export const locBoard = {
  panel:
    'flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-950/80',
  panelHeader:
    'flex flex-none items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-900/80',
  panelTitle: 'text-sm font-bold uppercase tracking-[0.7px] text-slate-800 dark:text-slate-100',
  panelBody: 'custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto p-2.5',
  empty:
    'flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-xs text-slate-400 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-500',
  listItem:
    'group grid min-h-11 cursor-pointer items-center gap-x-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0 transition-all duration-[180ms] ease hover:bg-sky-50/90 dark:border-slate-800 dark:hover:bg-sky-500/10',
  listItemCity: 'grid-cols-[minmax(0,1fr)_4.5rem] items-center',
  listItemBrgy: 'grid-cols-[minmax(0,1fr)_4.5rem] items-center',
  listItemActive:
    'bg-brand-blue/5 shadow-[inset_4px_0_0_#4B89CD] dark:bg-brand-blue/10',
  // Keep natural casing so city/barangay renames are visibly different in the list.
  listName:
    'min-w-0 truncate whitespace-nowrap text-[14px] font-semibold leading-snug text-slate-600 dark:text-slate-300',
  listNameBrgy:
    'min-w-0 truncate whitespace-nowrap text-[14px] font-semibold leading-snug text-slate-600 dark:text-slate-300',
  listMeta: 'text-[11px] font-medium text-slate-400',
  listTrailing: 'group/trailing relative flex h-8 w-full items-center justify-end',
  listCountBadge:
    'inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 transition-all duration-[180ms] ease group-hover/trailing:translate-x-2 group-hover/trailing:opacity-0 group-focus-within/trailing:translate-x-2 group-focus-within/trailing:opacity-0 dark:bg-slate-800 dark:text-slate-300',
  listActions:
    'pointer-events-none absolute right-0 flex items-center justify-end gap-1.5 translate-x-2 opacity-0 transition-all duration-[180ms] ease group-hover/trailing:pointer-events-auto group-hover/trailing:translate-x-0 group-hover/trailing:opacity-100 group-focus-within/trailing:pointer-events-auto group-focus-within/trailing:translate-x-0 group-focus-within/trailing:opacity-100',
  listEditBtn:
    'inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-sky-600 transition-all duration-[180ms] ease hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-500/10 dark:hover:text-sky-300',
  listDeleteBtn:
    'inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-rose-600 transition-all duration-[180ms] ease hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300',
  navyBtn:
    'inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white',
  iconBtn:
    'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200',
  editBtn:
    'inline-flex h-7 w-7 items-center justify-center rounded-md bg-sky-100 text-sky-700 transition hover:bg-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:hover:bg-sky-500/30',
  deleteBtn:
    'inline-flex h-7 w-7 items-center justify-center rounded-md bg-rose-100 text-rose-600 transition hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/30',
  primaryCta:
    'h-10 rounded-xl bg-slate-800 px-4 text-xs font-black uppercase tracking-widest text-white shadow-sm hover:bg-slate-900',
} as const;

export function LocPanel({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn(locBoard.panel, className)}>
      <div className={locBoard.panelHeader}>
        <span className={locBoard.panelTitle}>{title}</span>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn(locBoard.panelBody, bodyClassName)}>{children}</div>
    </div>
  );
}

export function LocEmpty({ children }: { children: React.ReactNode }) {
  return <div className={locBoard.empty}>{children}</div>;
}
