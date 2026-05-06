import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Users,
  Building2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Calendar as CalendarIcon,
  Sun,
  Sunset,
  Moon,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/data-table';
import {
  format,
  isAfter,
  isBefore,
  addDays,
  parseISO,
  subDays,
  subMonths,
  differenceInCalendarDays,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { Contract, Payment } from '@/types';
import { useDateRange, toYYYYMMDD } from '@/context/DateRangeContext';
import { useAuth } from '@/context/AuthContext';
import { fetchUnits } from '@/lib/unitsApi';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchPayments } from '@/lib/paymentsApi';
import { fetchTenants } from '@/lib/tenantsApi';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b'];

function sumPaidBetween(payments: Payment[], startYmd: string, endYmd: string): number {
  return payments
    .filter((p) => p.status === 'Paid')
    .filter((p) => {
      const d = (p.paidDate || p.dueDate || '').slice(0, 10);
      return d.length >= 10 && d >= startYmd && d <= endYmd;
    })
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
}

const occupancyData = (t: (key: string) => string, units: Array<{ status: string }>) => [
  { name: t('views.dashboard.charts.statuses.occupied'), value: units.filter((u) => u.status === 'Occupied').length },
  { name: t('views.dashboard.charts.statuses.available'), value: units.filter((u) => u.status === 'Available').length },
  { name: t('views.dashboard.charts.statuses.maintenance'), value: units.filter((u) => u.status === 'Maintenance').length },
];

function getGreeting(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', icon: <Sun className="w-5 h-5 text-amber-400" /> };
  if (hour < 18) return { text: 'Good afternoon', icon: <Sunset className="w-5 h-5 text-orange-400" /> };
  return { text: 'Good evening', icon: <Moon className="w-5 h-5 text-indigo-400" /> };
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtext: string;
  subtextVariant?: 'up' | 'down' | 'alert' | 'neutral';
  icon: React.ReactNode;
  iconBg: string;
}

function StatCard({ label, value, subtext, subtextVariant = 'neutral', icon, iconBg }: StatCardProps) {
  return (
    <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', iconBg)}>{icon}</div>
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{value}</div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{label}</p>
        <div
          className={cn(
            'flex items-center gap-1 mt-3 text-xs font-medium',
            subtextVariant === 'up' && 'text-emerald-600',
            subtextVariant === 'down' && 'text-rose-500',
            subtextVariant === 'alert' && 'text-rose-500',
            subtextVariant === 'neutral' && 'text-slate-400 dark:text-slate-500',
          )}
        >
          {subtextVariant === 'up' && <ArrowUpRight className="w-3 h-3" />}
          {subtextVariant === 'down' && <ArrowDownRight className="w-3 h-3" />}
          {subtextVariant === 'alert' && <AlertCircle className="w-3 h-3" />}
          {subtext}
        </div>
      </CardContent>
    </Card>
  );
}

type AgentRow = { id: string; name: string; deals: number; profit: number; status: string };

export function DashboardView() {
  const { t, i18n } = useTranslation();
  const { dateRange } = useDateRange();
  const { session } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [salesChartMetric, setSalesChartMetric] = useState<'collected' | 'newLeases'>('collected');
  const [salesChartStyle, setSalesChartStyle] = useState<'bar' | 'line'>('bar');

  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    void (async () => {
      try {
        const [u, c, p, tn] = await Promise.all([fetchUnits(), fetchContracts(), fetchPayments(), fetchTenants()]);
        if (cancelled) return;
        setUnits(u);
        setContracts(c);
        setPayments(p);
        setTenants(tn);
      } catch {
        if (cancelled) return;
        setUnits([]);
        setContracts([]);
        setPayments([]);
        setTenants([]);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const updateMode = () => setIsDarkMode(root.classList.contains('dark'));
    updateMode();
    const observer = new MutationObserver(updateMode);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const firstName = session?.user?.firstName ?? 'there';
  const greeting = getGreeting();
  const today = new Date().toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const periodTotals = useMemo(() => {
    if (!dateRange.start || !dateRange.end) {
      return { current: 0, previous: 0, prevStart: '', prevEnd: '' };
    }
    const rangeStart = parseISO(dateRange.start + 'T12:00:00');
    const rangeEnd = parseISO(dateRange.end + 'T12:00:00');
    const days = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
    const prevEnd = subDays(rangeStart, 1);
    const prevStart = subDays(prevEnd, days - 1);
    const startCur = toYYYYMMDD(rangeStart);
    const endCur = toYYYYMMDD(rangeEnd);
    const startPrev = toYYYYMMDD(prevStart);
    const endPrev = toYYYYMMDD(prevEnd);
    return {
      current: sumPaidBetween(payments, startCur, endCur),
      previous: sumPaidBetween(payments, startPrev, endPrev),
      prevStart: startPrev,
      prevEnd: endPrev,
    };
  }, [payments, dateRange.start, dateRange.end]);

  const collectedTrend = useMemo(() => {
    const { current, previous } = periodTotals;
    if (current === 0 && previous === 0) {
      return { variant: 'neutral' as const, text: t('views.dashboard.cards.trendNoData') };
    }
    if (previous === 0 && current > 0) {
      return { variant: 'up' as const, text: t('views.dashboard.cards.collectionsStarted') };
    }
    const pct = Math.round(((current - previous) / previous) * 1000) / 10;
    if (pct === 0) return { variant: 'neutral' as const, text: t('views.dashboard.cards.trendFlat') };
    if (pct > 0) return { variant: 'up' as const, text: t('views.dashboard.cards.trendUp', { pct: Math.abs(pct) }) };
    return { variant: 'down' as const, text: t('views.dashboard.cards.trendDown', { pct: Math.abs(pct) }) };
  }, [periodTotals, t]);

  const activeContracts = useMemo(() => contracts.filter((c) => c.status === 'Active').length, [contracts]);

  const baseMonthlyRentProfit = useMemo(
    () => contracts.filter((c) => c.status === 'Active').reduce((sum, contract) => sum + (Number(contract.monthlyRent) || 0), 0),
    [contracts],
  );

  const availableUnits = useMemo(() => units.filter((u) => u.status === 'Available').length, [units]);
  const vacancyRate = units.length ? ((availableUnits / units.length) * 100).toFixed(1) : '0.0';

  const overduePayments = useMemo(() => payments.filter((p) => p.status === 'Overdue').length, [payments]);

  const newLeasesThisWeekCount = useMemo(() => {
    const startWeek = startOfDay(subDays(new Date(), 7));
    const endToday = endOfDay(new Date());
    return contracts.filter((c) => {
      try {
        const sd = parseISO(c.startDate);
        return !isBefore(sd, startWeek) && !isAfter(sd, endToday);
      } catch {
        return false;
      }
    }).length;
  }, [contracts]);

  const upcomingPayments7Days = useMemo(
    () =>
      payments
        .filter((payment) => {
          try {
            const due = parseISO(payment.dueDate);
            return (
              payment.status !== 'Paid' && isAfter(due, new Date()) && isBefore(due, addDays(new Date(), 8))
            );
          } catch {
            return false;
          }
        })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [payments],
  );

  const vacancyContracts = useMemo(
    () => contracts.filter((c) => isBefore(new Date(c.endDate), addDays(new Date(), 60))),
    [contracts],
  );

  const chartAnchor = useMemo(() => {
    if (dateRange.end) {
      try {
        return parseISO(dateRange.end + 'T12:00:00');
      } catch {
        return new Date();
      }
    }
    return new Date();
  }, [dateRange.end]);

  const monthlyBars = useMemo(() => {
    const rows: { label: string; collected: number; newLeases: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = subMonths(chartAnchor, i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = format(d, 'MMM');
      const collected = payments
        .filter((p) => p.status === 'Paid')
        .filter((p) => {
          const raw = (p.paidDate || p.dueDate || '').slice(0, 7);
          return raw === ym;
        })
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const newLeases = contracts.filter((c) => (c.startDate || '').slice(0, 7) === ym).length;
      rows.push({ label, collected, newLeases });
    }
    return rows;
  }, [payments, contracts, chartAnchor]);

  const pieSlices = useMemo(() => occupancyData(t, units), [t, units]);

  const agentRows: AgentRow[] = useMemo(() => {
    const map = new Map<string, { name: string; deals: number; profit: number }>();
    for (const c of contracts) {
      const aid = String(c.agentId ?? '').trim();
      if (!aid) continue;
      const name = (c.agentName && c.agentName.trim()) || `Agent ${aid}`;
      const prev = map.get(aid);
      const rent = Number(c.monthlyRent) || 0;
      if (prev) {
        prev.deals += 1;
        if (c.status === 'Active') prev.profit += rent;
      } else {
        map.set(aid, { name, deals: 1, profit: c.status === 'Active' ? rent : 0 });
      }
    }
    const rows = Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.deals - a.deals || b.profit - a.profit);
    if (rows.length === 0) return [];
    const topDeals = rows[0].deals;
    return rows.map((r, idx) => ({
      id: r.id,
      name: r.name,
      deals: r.deals,
      profit: r.profit,
      status:
        idx === 0 && topDeals > 0
          ? t('views.dashboard.agents.statusTopPerformer')
          : r.deals >= 3
            ? t('views.dashboard.agents.statusActive')
            : t('views.dashboard.agents.statusOnProbation'),
    }));
  }, [contracts, t]);

  const vacancyColumns: ColumnDef<Contract>[] = useMemo(
    () => [
      {
        header: t('views.dashboard.vacancies.unit'),
        render: (c) => {
          const unit = units.find((u) => String(u.id) === String(c.unitId));
          return (
            <span className="font-medium">
              {unit?.unitNumber} - {unit?.buildingName}
            </span>
          );
        },
      },
      {
        header: t('views.dashboard.vacancies.tenant'),
        render: (c) => {
          const tenant = tenants.find((ten: any) => String(ten.id) === String(c.tenantId));
          return <span>{tenant?.name || t('views.dashboard.vacancies.fallbackTenant')}</span>;
        },
      },
      {
        header: t('views.dashboard.vacancies.expiryDate'),
        render: (c) => <span>{format(new Date(c.endDate), 'MMM dd, yyyy')}</span>,
      },
      {
        header: t('views.dashboard.vacancies.notice'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (c) => {
          const daysLeft = Math.ceil((new Date(c.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
          return (
            <Badge
              className={cn(
                'h-auto rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide border',
                daysLeft <= 30
                  ? 'bg-rose-100 text-rose-800 border-rose-300/80 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/45'
                  : 'bg-amber-100 text-amber-800 border-amber-300/80 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/45',
              )}
            >
              {daysLeft <= 30 ? t('views.dashboard.vacancies.oneMonth') : t('views.dashboard.vacancies.twoMonth')}
            </Badge>
          );
        },
      },
    ],
    [t, units, tenants],
  );

  const paymentColumns: ColumnDef<Payment>[] = useMemo(
    () => [
      {
        header: t('views.dashboard.payments.unit'),
        render: (payment) => {
          const unit = units.find((u) => String(u.id) === String(payment.unitId));
          return (
            <span className="font-medium">
              {unit?.unitNumber} - {unit?.buildingName}
            </span>
          );
        },
      },
      {
        header: t('views.dashboard.payments.tenant'),
        render: (payment) => {
          const contract = contracts.find((c) => String(c.id) === String(payment.contractId));
          const tenant = contract ? tenants.find((ten: any) => String(ten.id) === String(contract.tenantId)) : null;
          return <span>{tenant?.name}</span>;
        },
      },
      {
        header: t('views.dashboard.payments.dueDate'),
        render: (payment) => <span>{format(new Date(payment.dueDate), 'MMM dd, yyyy')}</span>,
      },
      {
        header: t('views.dashboard.payments.amount'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (payment) => <span className="font-semibold">₱{payment.amount.toLocaleString()}</span>,
      },
    ],
    [t, units, tenants, contracts],
  );

  const agentColumns: ColumnDef<AgentRow>[] = useMemo(
    () => [
      {
        header: t('views.dashboard.agents.agentName'),
        render: (a) => (
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-500/25 text-indigo-700 dark:text-indigo-200 flex items-center justify-center text-xs font-bold shrink-0">
              {a.name.charAt(0)}
            </div>
            <span className="font-medium">{a.name}</span>
          </div>
        ),
      },
      {
        header: t('views.dashboard.agents.deals'),
        className: 'text-center',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (a) => <span className="font-medium">{a.deals}</span>,
      },
      {
        header: t('views.dashboard.agents.profit'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (a) => <span className="font-mono text-xs">₱{a.profit.toLocaleString()}</span>,
      },
      {
        header: t('views.dashboard.agents.status'),
        className: 'text-right pr-6',
        headerClassName: 'text-right pr-6',
        cellClassName: 'text-right pr-6',
        render: (a) => (
          <Badge
            variant={a.status === t('views.dashboard.agents.statusTopPerformer') ? 'default' : 'outline'}
            className={cn(a.status === t('views.dashboard.agents.statusTopPerformer') && 'bg-indigo-600')}
          >
            {a.status}
          </Badge>
        ),
      },
    ],
    [t],
  );

  const chartGridColor = isDarkMode ? '#334155' : '#f1f5f9';
  const chartTickColor = '#94a3b8';
  const chartCursorColor = isDarkMode ? '#1e293b' : '#f8fafc';
  const tooltipStyle = {
    borderRadius: '10px',
    border: isDarkMode ? '1px solid #334155' : 'none',
    boxShadow: isDarkMode ? '0 4px 20px -2px rgb(0 0 0 / 0.45)' : '0 4px 20px -2px rgb(0 0 0 / 0.12)',
    fontSize: 13,
    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
    color: isDarkMode ? '#e2e8f0' : '#0f172a',
  } as const;

  if (dataLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 animate-in fade-in duration-300">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 dark:text-indigo-400" aria-hidden />
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('views.dashboard.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {greeting.icon}
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{greeting.text},</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{firstName} 👋</h1>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">{today}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label={t('views.dashboard.cards.totalProfit')}
          value={`₱${periodTotals.current.toLocaleString()}`}
          subtext={collectedTrend.text}
          subtextVariant={collectedTrend.variant === 'down' ? 'down' : collectedTrend.variant === 'up' ? 'up' : 'neutral'}
          iconBg="bg-indigo-50 dark:bg-indigo-500/20"
          icon={<DollarSign className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          label={t('views.dashboard.cards.netProfit')}
          value={`₱${baseMonthlyRentProfit.toLocaleString()}`}
          subtext={t('views.dashboard.cards.netProfitHint')}
          subtextVariant="neutral"
          iconBg="bg-violet-50 dark:bg-violet-500/20"
          icon={<TrendingUp className="w-5 h-5 text-violet-600" />}
        />
        <StatCard
          label={t('views.dashboard.cards.activeLeases')}
          value={activeContracts}
          subtext={
            newLeasesThisWeekCount > 0
              ? t('views.dashboard.cards.newLeasesThisWeek', { count: newLeasesThisWeekCount })
              : t('views.dashboard.cards.newLeasesThisWeekZero')
          }
          subtextVariant={newLeasesThisWeekCount > 0 ? 'up' : 'neutral'}
          iconBg="bg-emerald-50 dark:bg-emerald-500/20"
          icon={<Users className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          label={t('views.dashboard.cards.vacancyRate')}
          value={`${vacancyRate}%`}
          subtext={`${availableUnits} ${availableUnits === 1 ? 'unit' : 'units'} available`}
          subtextVariant="down"
          iconBg="bg-amber-50 dark:bg-amber-500/20"
          icon={<Building2 className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          label={t('views.dashboard.cards.overdueRent')}
          value={overduePayments}
          subtext={t('views.dashboard.cards.overdueHint')}
          subtextVariant={overduePayments > 0 ? 'alert' : 'neutral'}
          iconBg="bg-rose-50 dark:bg-rose-500/20"
          icon={<AlertCircle className="w-5 h-5 text-rose-500" />}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('views.dashboard.charts.salesTitle')}</CardTitle>
            <CardDescription>{t('views.dashboard.charts.salesDescription')}</CardDescription>
            <CardAction className="flex flex-col items-end gap-2 sm:flex-row sm:items-start sm:gap-2">
              <div
                className="inline-flex rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/60 p-0.5"
                role="group"
                aria-label={t('views.dashboard.charts.chartMetricAria')}
              >
                <button
                  type="button"
                  onClick={() => setSalesChartMetric('collected')}
                  aria-pressed={salesChartMetric === 'collected'}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    salesChartMetric === 'collected'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
                  )}
                >
                  {t('views.dashboard.charts.profitLabel')}
                </button>
                <button
                  type="button"
                  onClick={() => setSalesChartMetric('newLeases')}
                  aria-pressed={salesChartMetric === 'newLeases'}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    salesChartMetric === 'newLeases'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
                  )}
                >
                  {t('views.dashboard.charts.newLeasesLabel')}
                </button>
              </div>
              <div
                className="inline-flex rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/60 p-0.5"
                role="group"
                aria-label={t('views.dashboard.charts.chartStyleAria')}
              >
                <button
                  type="button"
                  onClick={() => setSalesChartStyle('bar')}
                  aria-pressed={salesChartStyle === 'bar'}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    salesChartStyle === 'bar'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
                  )}
                >
                  {t('views.dashboard.charts.chartStyleBar')}
                </button>
                <button
                  type="button"
                  onClick={() => setSalesChartStyle('line')}
                  aria-pressed={salesChartStyle === 'line'}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    salesChartStyle === 'line'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
                  )}
                >
                  {t('views.dashboard.charts.chartStyleLine')}
                </button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyBars} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: chartTickColor, fontSize: 12 }} />
                {salesChartMetric === 'collected' ? (
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: chartTickColor, fontSize: 12 }}
                    tickFormatter={(val) => `₱${Number(val) / 1000}k`}
                  />
                ) : (
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: chartTickColor, fontSize: 12 }}
                    allowDecimals={false}
                  />
                )}
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={
                    salesChartStyle === 'bar'
                      ? { fill: chartCursorColor }
                      : { stroke: chartGridColor, strokeWidth: 1, strokeDasharray: '4 4' }
                  }
                  formatter={(val: number, name: string) =>
                    salesChartMetric === 'newLeases' || name === t('views.dashboard.charts.newLeasesLabel')
                      ? [val, name]
                      : [`₱${val.toLocaleString()}`, name]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {salesChartMetric === 'collected' &&
                  (salesChartStyle === 'bar' ? (
                    <Bar
                      yAxisId="left"
                      dataKey="collected"
                      name={t('views.dashboard.charts.profitLabel')}
                      fill="#4f46e5"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={36}
                    />
                  ) : (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="collected"
                      name={t('views.dashboard.charts.profitLabel')}
                      stroke="#4f46e5"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                {salesChartMetric === 'newLeases' &&
                  (salesChartStyle === 'bar' ? (
                    <Bar
                      yAxisId="left"
                      dataKey="newLeases"
                      name={t('views.dashboard.charts.newLeasesLabel')}
                      fill="#10b981"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={36}
                    />
                  ) : (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="newLeases"
                      name={t('views.dashboard.charts.newLeasesLabel')}
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 4 }}
                    />
                  ))}
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('views.dashboard.charts.unitStatusTitle')}</CardTitle>
            <CardDescription>{t('views.dashboard.charts.unitStatusDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="78%">
              <PieChart>
                <Pie
                  data={pieSlices}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieSlices.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(val: number, name: string) => [val, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
              {pieSlices.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span>{entry.name}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="gap-0 overflow-hidden border border-slate-200/80 dark:border-slate-800 py-0 shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 px-6 pt-5 pb-4">
            <CardTitle className="text-base">{t('views.dashboard.vacancies.title')}</CardTitle>
            <CardDescription>{t('views.dashboard.vacancies.description')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {vacancyContracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                <Building2 className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">No upcoming vacancies</p>
              </div>
            ) : (
              <DataTable
                data={vacancyContracts}
                columns={vacancyColumns}
                keyExtractor={(c) => c.id}
                embedded
                highlightFirstColumn={false}
              />
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 overflow-hidden border border-slate-200/80 dark:border-slate-800 py-0 shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 px-6 pt-5 pb-4">
            <CardTitle className="text-base">{t('views.dashboard.payments.title')}</CardTitle>
            <CardDescription>{t('views.dashboard.payments.description')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingPayments7Days.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                <CalendarIcon className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">{t('views.dashboard.payments.empty')}</p>
              </div>
            ) : (
              <DataTable
                data={upcomingPayments7Days}
                columns={paymentColumns}
                keyExtractor={(p) => p.id}
                embedded
                highlightFirstColumn={false}
              />
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 overflow-hidden border border-slate-200/80 dark:border-slate-800 py-0 shadow-sm lg:col-span-2 bg-white dark:bg-slate-900">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 px-6 pt-5 pb-4">
            <CardTitle className="text-base">{t('views.dashboard.agents.title')}</CardTitle>
            <CardDescription>{t('views.dashboard.agents.description')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {agentRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-slate-400 dark:text-slate-500">
                <Users className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">{t('views.dashboard.agents.empty')}</p>
              </div>
            ) : (
              <DataTable
                data={agentRows}
                columns={agentColumns}
                keyExtractor={(a) => a.id}
                embedded
                highlightFirstColumn={false}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
