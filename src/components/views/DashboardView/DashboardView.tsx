import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { StatusBadge } from '@/components/status-badge';
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

/** Merit brand accents — fixed per unit status (not index-based). */
const UNIT_STATUS_COLORS = {
  occupied: '#4B89CD',
  available: '#43A751',
  maintenance: '#f08135',
} as const;

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
  {
    name: t('views.dashboard.charts.statuses.available'),
    value: units.filter((u) => u.status === 'Available').length,
    color: UNIT_STATUS_COLORS.available,
  },
  {
    name: t('views.dashboard.charts.statuses.occupied'),
    value: units.filter((u) => u.status === 'Occupied').length,
    color: UNIT_STATUS_COLORS.occupied,
  },
  {
    name: t('views.dashboard.charts.statuses.maintenance'),
    value: units.filter((u) => u.status === 'Maintenance').length,
    color: UNIT_STATUS_COLORS.maintenance,
  },
];

function getGreeting(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', icon: <Sun className="w-5 h-5 text-amber-400" /> };
  if (hour < 18) return { text: 'Good afternoon', icon: <Sunset className="w-5 h-5 text-orange-400" /> };
  return { text: 'Good evening', icon: <Moon className="w-5 h-5 text-brand-blue" /> };
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtext: string;
  subtextVariant?: 'up' | 'down' | 'alert' | 'neutral';
  icon: React.ReactNode;
  iconColor: string;
  onClick?: () => void;
  clickHint?: string;
}

function StatCard({
  label,
  value,
  subtext,
  subtextVariant = 'neutral',
  icon,
  iconColor,
  onClick,
  clickHint,
}: StatCardProps) {
  const interactive = Boolean(onClick);
  const body = (
    <>
      <div className="mb-4 flex items-start justify-between">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded text-white shadow-lg', iconColor)}>
          {icon}
        </div>
        <div className="text-right">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{value}</h3>
        </div>
      </div>
      <div
        className={cn(
          'mt-auto flex items-center gap-1 border-t border-slate-50 pt-3 text-xs font-medium transition-colors dark:border-slate-800',
          subtextVariant === 'up' && 'text-brand-green',
          subtextVariant === 'down' && 'text-rose-500',
          subtextVariant === 'alert' && 'text-rose-500',
          subtextVariant === 'neutral' && 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500',
          interactive && 'underline-offset-2 group-hover:underline',
        )}
      >
        {subtextVariant === 'up' && <ArrowUpRight className="h-3 w-3" />}
        {subtextVariant === 'down' && <ArrowDownRight className="h-3 w-3" />}
        {subtextVariant === 'alert' && <AlertCircle className="h-3 w-3" />}
        {subtext}
      </div>
    </>
  );

  const cardClass = cn(
    'group relative flex w-full flex-col overflow-hidden rounded-lg border border-slate-100 bg-white p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900',
    interactive &&
      'cursor-pointer transition hover:border-brand-blue/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} title={clickHint || subtext} className={cardClass}>
        {body}
      </button>
    );
  }

  return <div className={cardClass}>{body}</div>;
}

type AgentRow = { id: string; name: string; deals: number; profit: number; status: string };

export function DashboardView() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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
    () =>
      contracts
        .filter((c) => c.status === 'Active')
        .reduce((sum, contract) => sum + (Number(contract.monthlyRent) || 0), 0),
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
            <StatusBadge tone={daysLeft <= 30 ? 'danger' : 'warning'}>
              {daysLeft <= 30 ? t('views.dashboard.vacancies.oneMonth') : t('views.dashboard.vacancies.twoMonth')}
            </StatusBadge>
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
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-xs font-bold text-brand-blue dark:bg-brand-blue/25 dark:text-blue-200">
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
            className={cn(a.status === t('views.dashboard.agents.statusTopPerformer') && 'bg-brand-blue')}
          >
            {a.status}
          </Badge>
        ),
      },
    ],
    [t],
  );

  const chartGridColor = isDarkMode ? '#334155' : '#f1f5f9';
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
        <Loader2 className="h-10 w-10 animate-spin text-brand-blue" aria-hidden />
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
          iconColor="bg-[#334155]"
          icon={<DollarSign className="h-6 w-6" />}
          clickHint={t('views.dashboard.cards.viewPaidHint')}
          onClick={() => {
            if (!dateRange.start || !dateRange.end) {
              navigate('/ledger?tab=paid');
              return;
            }
            const params = new URLSearchParams({
              tab: 'paid',
              from: dateRange.start,
              to: dateRange.end,
            });
            navigate(`/ledger?${params.toString()}`);
          }}
        />
        <StatCard
          label={t('views.dashboard.cards.netProfit')}
          value={`₱${baseMonthlyRentProfit.toLocaleString()}`}
          subtext={t('views.dashboard.cards.netProfitHint')}
          subtextVariant="neutral"
          iconColor="bg-brand-blue"
          icon={<TrendingUp className="h-6 w-6" />}
          clickHint={t('views.dashboard.cards.viewMonthlyRentBaseHint')}
          onClick={() => navigate('/contracts?status=Active')}
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
          iconColor="bg-brand-green"
          icon={<Users className="h-6 w-6" />}
          clickHint={t('views.dashboard.cards.viewActiveLeasesHint')}
          onClick={() =>
            navigate(
              newLeasesThisWeekCount > 0
                ? '/contracts?status=Active&newThisWeek=1'
                : '/contracts?status=Active',
            )
          }
        />
        <StatCard
          label={t('views.dashboard.cards.vacancyRate')}
          value={`${vacancyRate}%`}
          subtext={`${availableUnits} ${availableUnits === 1 ? 'unit' : 'units'} available`}
          subtextVariant="down"
          iconColor="bg-brand-orange"
          icon={<Building2 className="h-6 w-6" />}
          clickHint={t('views.dashboard.cards.viewAvailableUnitsHint')}
          onClick={() => navigate('/units?status=Available')}
        />
        <StatCard
          label={t('views.dashboard.cards.overdueRent')}
          value={overduePayments}
          subtext={t('views.dashboard.cards.overdueHint')}
          subtextVariant={overduePayments > 0 ? 'alert' : 'neutral'}
          iconColor="bg-rose-500"
          icon={<AlertCircle className="h-6 w-6" />}
          clickHint={t('views.dashboard.cards.viewOverdueHint')}
          onClick={() => navigate('/ledger?tab=outstanding')}
        />
      </div>

      {/* Charts Section — Merit bar/pie chrome */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="flex h-[420px] flex-col rounded-lg border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:h-[480px] lg:col-span-2">
          <div className="flex shrink-0 flex-col gap-3 border-b border-slate-50 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-bold uppercase text-brand-blue">
              {t('views.dashboard.charts.salesTitle')}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex rounded-full border border-slate-200 bg-slate-100/90 p-0.5 dark:border-slate-700 dark:bg-slate-800/60"
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
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
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
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                  )}
                >
                  {t('views.dashboard.charts.newLeasesLabel')}
                </button>
              </div>
              <div
                className="inline-flex rounded-full border border-slate-200 bg-slate-100/90 p-0.5 dark:border-slate-700 dark:bg-slate-800/60"
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
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
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
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                  )}
                >
                  {t('views.dashboard.charts.chartStyleLine')}
                </button>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyBars} barGap={4} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                <XAxis
                  dataKey="label"
                  angle={-45}
                  textAnchor="end"
                  interval="preserveStartEnd"
                  height={80}
                  stroke="#94a3b8"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                {salesChartMetric === 'collected' ? (
                  <YAxis
                    yAxisId="left"
                    stroke="#94a3b8"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(val) => `₱${Number(val) / 1000}k`}
                  />
                ) : (
                  <YAxis
                    yAxisId="left"
                    stroke="#94a3b8"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
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
                  formatter={(val, name) => {
                    const n = Number(val ?? 0);
                    const label = String(name ?? '');
                    return salesChartMetric === 'newLeases' || label === t('views.dashboard.charts.newLeasesLabel')
                      ? [n, label]
                      : [`₱${n.toLocaleString()}`, label];
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="center"
                  iconType="rect"
                  wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', color: '#94a3b8' }}
                />
                {salesChartMetric === 'collected' &&
                  (salesChartStyle === 'bar' ? (
                    <Bar
                      yAxisId="left"
                      dataKey="collected"
                      name={t('views.dashboard.charts.profitLabel')}
                      fill="#4B89CD"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  ) : (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="collected"
                      name={t('views.dashboard.charts.profitLabel')}
                      stroke="#4B89CD"
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
                      fill="#4B89CD"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  ) : (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="newLeases"
                      name={t('views.dashboard.charts.newLeasesLabel')}
                      stroke="#4B89CD"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 4 }}
                    />
                  ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="flex h-[420px] flex-col rounded-lg border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:h-[480px]">
          <div className="shrink-0 border-b border-slate-50 p-4 dark:border-slate-800">
            <h3 className="text-sm font-bold uppercase text-brand-blue">
              {t('views.dashboard.charts.unitStatusTitle')}
            </h3>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieSlices}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  nameKey="name"
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {pieSlices.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val, name) => [Number(val ?? 0), String(name ?? '')]}
                />
                <Legend
                  verticalAlign="top"
                  align="center"
                  iconType="rect"
                  wrapperStyle={{ paddingTop: '20px', fontSize: '10px', color: '#94a3b8' }}
                  formatter={(value) => <span className="text-slate-500">{value}</span>}
                  payload={pieSlices.map((s) => ({
                    value: s.name,
                    type: 'rect' as const,
                    color: s.color,
                    id: s.name,
                  }))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
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
                              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
