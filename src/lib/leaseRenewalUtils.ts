import { addDays, addMonths, addYears, parseISO } from 'date-fns';
import type { Contract, LeaseRenewalTerms } from '@/types';

export function formatPhp(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₱0.00';
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseRentInput(value: string): number {
  const cleaned = value.replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function formatRentInput(value: string): string {
  const n = parseRentInput(value);
  if (!Number.isFinite(n) || n <= 0) return value.replace(/[^\d.]/g, '');
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function stripDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function rentWithPercentIncrease(base: number, pct: number): number {
  return Math.round(base * (1 + pct / 100) * 100) / 100;
}

export function computeIncreasePct(previous: number, next: number): number {
  if (!Number.isFinite(previous) || previous <= 0 || !Number.isFinite(next)) return 0;
  return Math.round(((next - previous) / previous) * 10000) / 100;
}

export function applyLeaseTermPreset(start: Date, term: string): Date {
  const s = stripDate(start);
  if (term === '24') return addYears(s, 2);
  if (term === 'custom') return addYears(s, 1);
  return addYears(s, 1);
}

export function defaultTermsFromContract(contract: Contract): LeaseRenewalTerms {
  const prevEnd = stripDate(parseISO(contract.endDate));
  const start = addDays(prevEnd, 1);
  const end = addYears(start, 1);
  const prevRent = Number(contract.monthlyRent ?? 0);
  const newRent = rentWithPercentIncrease(prevRent, 5);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    leaseTerm: '12',
    monthlyRent: newRent,
    previousRent: prevRent,
    securityDeposit: Number(contract.securityDeposit ?? 0),
    advanceRent: Number(contract.advanceRent ?? 0),
    parkingFee: 0,
    associationDues: 0,
    renewalFee: 0,
    rentIncreasePercentage: computeIncreasePct(prevRent, newRent),
  };
}

export function totalBalanceBreakdown(breakdown: Record<string, number | undefined>): number {
  return ['outstandingRent', 'utilities', 'penalties', 'parkingFees', 'otherCharges'].reduce(
    (sum, key) => sum + Number(breakdown[key] ?? 0),
    0,
  );
}

export function termsFromEndDateChange(startIso: string, end: Date): Partial<LeaseRenewalTerms> {
  const start = parseISO(startIso);
  const months = Math.max(
    1,
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()),
  );
  let leaseTerm = 'custom';
  if (months === 12) leaseTerm = '12';
  else if (months === 24) leaseTerm = '24';
  return { endDate: end.toISOString().slice(0, 10), leaseTerm };
}

export function termsFromStartAndTerm(start: Date, term: string): Partial<LeaseRenewalTerms> {
  const s = stripDate(start);
  let end: Date;
  if (term === '24') end = addYears(s, 2);
  else if (term === '12') end = addYears(s, 1);
  else end = addMonths(s, 12);
  return {
    startDate: s.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    leaseTerm: term,
  };
}
