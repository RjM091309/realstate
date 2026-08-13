import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Banknote,
  Building2,
  Loader2,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { MetricStatCard } from '@/components/MetricStatCard';
import { useDateRange } from '@/context/DateRangeContext';
import { fetchUnits } from '@/lib/unitsApi';
import { fetchContracts } from '@/lib/contractsApi';
import { fetchPayments } from '@/lib/paymentsApi';
import { fetchMaintenanceRequests, type MaintenanceRequestRow } from '@/lib/specialRequestsApi';
import { fetchVendors, type VendorRow } from '@/lib/vendorsApi';
import type { Contract, Payment } from '@/types';

type UnitRow = { id: string; status: string };

const CATEGORY_COLORS: Record<string, string> = {
  plumbing: '#4B89CD',
  electrical: '#f08135',
  hvac: '#43A751',
  carpentry: '#a855f7',
  painting: '#eab308',
  pest_control: '#e11d48',
  cleaning: '#06b6d4',
  appliance: '#6366f1',
  general: '#64748b',
  other: '#94a3b8',
};

function formatLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sumPaidBetween(payments: Payment[], startYmd: string, endYmd: string): number {
  return payments
    .filter((p) => p.status === 'Paid')
    .filter((p) => {
      const d = (p.paidDate || p.dueDate || '').slice(0, 10);
      return d.length >= 10 && d >= startYmd && d <= endYmd;
    })
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
}

function sumMaintenanceCostBetween(requests: MaintenanceRequestRow[], startYmd: string, endYmd: string): number {
  return requests
    .filter((r) => r.actualCost != null)
    .filter((r) => {
      const d = (r.resolvedAt || r.createdAt || '').slice(0, 10);
      return d.length >= 10 && d >= startYmd && d <= endYmd;
    })
    .reduce((acc, r) => acc + Number(r.actualCost ?? 0), 0);
}

function formatPhp(n: number): string {
  return `₱${Math.round(n).toLocaleString()}`;
}

export function ReportsView() {
  const { t } = useTranslation();
  const { dateRange } = useDateRange();

  const [units, setUnits] = useState<UnitRow[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequestRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [u, c, p, m, v] = await Promise.all([
          fetchUnits(),
          fetchContracts(),
          fetchPayments(),
          fetchMaintenanceRequests(),
          fetchVendors(),
        ]);
        if (cancelled) return;
        setUnits(u);
        setContracts(c);
        setPayments(p);
        setMaintenance(m);
        setVendors(v);
      } catch {
        if (cancelled) return;
        setUnits([]);
        setContracts([]);
        setPayments([]);
        setMaintenance([]);
        setVendors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasRange = Boolean(dateRange.start && dateRange.end);

  const collected = useMemo(
    () => (hasRange ? sumPaidBetween(payments, dateRange.start, dateRange.end) : 0),
    [payments, dateRange, hasRange],
  );
  const expense = useMemo(
    () => (hasRange ? sumMaintenanceCostBetween(maintenance, dateRange.start, dateRange.end) : 0),
    [maintenance, dateRange, hasRange],
  );
  const netIncome = collected - expense;

  const occupancy = useMemo(() => {
    const occupied = units.filter((u) => u.status === 'Occupied').length;
    const rate = units.length ? (occupied / units.length) * 100 : 0;
    return { occupied, total: units.length, rate: rate.toFixed(1) };
  }, [units]);

  const monthlyTrend = useMemo(() => {
    const anchor = hasRange ? new Date(`${dateRange.end}T12:00:00`) : new Date();
    const rows: { label: string; collected: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(undefined, { month: 'short' });
      const collectedMonth = payments
        .filter((p) => p.status === 'Paid')
        .filter((p) => (p.paidDate || p.dueDate || '').slice(0, 7) === ym)
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const expenseMonth = maintenance
        .filter((r) => r.actualCost != null)
        .filter((r) => (r.resolvedAt || r.createdAt || '').slice(0, 7) === ym)
        .reduce((s, r) => s + Number(r.actualCost ?? 0), 0);
      rows.push({ label, collected: collectedMonth, expense: expenseMonth });
    }
    return rows;
  }, [payments, maintenance, dateRange, hasRange]);

  const expenseByCategory = useMemo(() => {
    const vendorCategory = new Map(vendors.map((v) => [v.id, v.category]));
    const totals = new Map<string, number>();
    for (const r of maintenance) {
      if (r.actualCost == null) continue;
      const category = (r.vendorId ? vendorCategory.get(r.vendorId) : null) ?? 'other';
      totals.set(category, (totals.get(category) ?? 0) + Number(r.actualCost));
    }
    return Array.from(totals.entries())
      .map(([category, value]) => ({ category, label: formatLabel(category), value }))
      .sort((a, b) => b.value - a.value);
  }, [maintenance, vendors]);

  const vendorSpend = useMemo(() => {
    const byVendor = new Map<string, { vendor: VendorRow; tickets: number; total: number }>();
    for (const r of maintenance) {
      if (!r.vendorId || r.actualCost == null) continue;
      const vendor = vendors.find((v) => v.id === r.vendorId);
      if (!vendor) continue;
      const cur = byVendor.get(r.vendorId) ?? { vendor, tickets: 0, total: 0 };
      cur.tickets += 1;
      cur.total += Number(r.actualCost);
      byVendor.set(r.vendorId, cur);
    }
    return Array.from(byVendor.values()).sort((a, b) => b.total - a.total);
  }, [maintenance, vendors]);

  const agentPerformance = useMemo(() => {
    const map = new Map<string, { id: string; name: string; deals: number; mrrBase: number; collectedPeriod: number }>();
    for (const c of contracts) {
      const aid = String(c.agentId ?? '').trim();
      if (!aid) continue;
      const name = (c.agentName && c.agentName.trim()) || `Agent ${aid}`;
      const prev = map.get(aid) ?? { id: aid, name, deals: 0, mrrBase: 0, collectedPeriod: 0 };
      prev.deals += 1;
      if (c.status === 'Active') prev.mrrBase += Number(c.monthlyRent) || 0;
      if (hasRange) {
        const contractPayments = payments.filter((p) => String(p.contractId) === String(c.id));
        prev.collectedPeriod += sumPaidBetween(contractPayments, dateRange.start, dateRange.end);
      }
      map.set(aid, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.mrrBase - a.mrrBase);
  }, [contracts, payments, dateRange, hasRange]);

  const isDarkMode = document.documentElement.classList.contains('dark');
  const chartGridColor = isDarkMode ? '#334155' : '#f1f5f9';
  const tooltipStyle = {
    borderRadius: '10px',
    border: isDarkMode ? '1px solid #334155' : 'none',
    boxShadow: isDarkMode ? '0 4px 20px -2px rgb(0 0 0 / 0.45)' : '0 4px 20px -2px rgb(0 0 0 / 0.12)',
    fontSize: 13,
    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
    color: isDarkMode ? '#e2e8f0' : '#0f172a',
  } as const;

  const vendorColumns: ColumnDef<(typeof vendorSpend)[number]>[] = [
    {
      header: t('views.reports.vendorSpend.columns.vendor'),
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-white">{row.vendor.name}</div>
          <div className="text-xs capitalize text-slate-500 dark:text-slate-400">
            {formatLabel(row.vendor.category)}
          </div>
        </div>
      ),
    },
    {
      header: t('views.reports.vendorSpend.columns.tickets'),
      className: 'text-center',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      render: (row) => <span>{row.tickets}</span>,
    },
    {
      header: t('views.reports.vendorSpend.columns.total'),
      className: 'text-right',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (row) => <span className="font-semibold">{formatPhp(row.total)}</span>,
    },
  ];

  const agentColumns: ColumnDef<(typeof agentPerformance)[number]>[] = [
    {
      header: t('views.reports.agentPerformance.columns.agent'),
      render: (row) => <span className="font-medium text-slate-900 dark:text-white">{row.name}</span>,
    },
    {
      header: t('views.reports.agentPerformance.columns.deals'),
      className: 'text-center',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      render: (row) => <span>{row.deals}</span>,
    },
    {
      header: t('views.reports.agentPerformance.columns.mrrBase'),
      className: 'text-right',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (row) => <span>{formatPhp(row.mrrBase)}</span>,
    },
    {
      header: t('views.reports.agentPerformance.columns.collectedPeriod'),
      className: 'text-right',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (row) => <span className="font-semibold text-brand-blue">{formatPhp(row.collectedPeriod)}</span>,
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
        <p className="text-sm">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('views.reports.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('views.reports.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricStatCard
          index={0}
          label={t('views.reports.stats.collected')}
          value={formatPhp(collected)}
          subtext={t('views.reports.stats.collectedHint')}
          subtextVariant="neutral"
          iconColor="bg-brand-blue"
          icon={<Banknote className="h-6 w-6" />}
        />
        <MetricStatCard
          index={1}
          label={t('views.reports.stats.expense')}
          value={formatPhp(expense)}
          subtext={t('views.reports.stats.expenseHint')}
          subtextVariant="neutral"
          iconColor="bg-rose-500"
          icon={<Wrench className="h-6 w-6" />}
        />
        <MetricStatCard
          index={2}
          label={t('views.reports.stats.netIncome')}
          value={formatPhp(netIncome)}
          subtext={t('views.reports.stats.netIncomeHint')}
          subtextVariant={netIncome >= 0 ? 'up' : 'down'}
          iconColor={netIncome >= 0 ? 'bg-brand-green' : 'bg-rose-500'}
          icon={netIncome >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
        />
        <MetricStatCard
          index={3}
          label={t('views.reports.stats.occupancy')}
          value={`${occupancy.rate}%`}
          subtext={t('views.reports.stats.occupancyHint', { occupied: occupancy.occupied, total: occupancy.total })}
          subtextVariant="neutral"
          iconColor="bg-brand-orange"
          icon={<Building2 className="h-6 w-6" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="flex h-[420px] flex-col rounded-lg border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="shrink-0 border-b border-slate-50 p-4 dark:border-slate-800">
            <h3 className="text-sm font-bold uppercase text-brand-blue">{t('views.reports.charts.trendTitle')}</h3>
          </div>
          <div className="min-h-0 flex-1 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyTrend} barGap={4} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(val) => `₱${Number(val) / 1000}k`}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => [`₱${Number(val ?? 0).toLocaleString()}`, name]} />
                <Legend
                  verticalAlign="top"
                  align="center"
                  iconType="rect"
                  wrapperStyle={{ paddingBottom: '16px', fontSize: '11px', color: '#94a3b8' }}
                />
                <Bar
                  dataKey="collected"
                  name={t('views.reports.charts.collectedLabel')}
                  fill="#43A751"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="expense"
                  name={t('views.reports.charts.expenseLabel')}
                  fill="#e11d48"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="flex h-[420px] flex-col rounded-lg border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="shrink-0 border-b border-slate-50 p-4 dark:border-slate-800">
            <h3 className="text-sm font-bold uppercase text-brand-blue">{t('views.reports.charts.expenseByCategoryTitle')}</h3>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            {expenseByCategory.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-center text-slate-400 dark:text-slate-500">
                <Wallet className="h-8 w-8" />
                <p className="text-xs">{t('views.reports.charts.noExpenseData')}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {expenseByCategory.map((entry) => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => [`₱${Number(val ?? 0).toLocaleString()}`, name]} />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border border-slate-100 shadow-sm dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase text-brand-blue">
              <Wrench className="h-4 w-4" />
              {t('views.reports.vendorSpend.title')}
            </CardTitle>
            <CardDescription>{t('views.reports.vendorSpend.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {vendorSpend.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-slate-400 dark:text-slate-500">
                <AlertCircle className="h-8 w-8" />
                <p className="text-xs">{t('views.reports.vendorSpend.empty')}</p>
              </div>
            ) : (
              <DataTable data={vendorSpend} columns={vendorColumns} keyExtractor={(row) => row.vendor.id} embedded />
            )}
          </CardContent>
        </Card>

        <Card className="border border-slate-100 shadow-sm dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase text-brand-blue">
              <Users className="h-4 w-4" />
              {t('views.reports.agentPerformance.title')}
            </CardTitle>
            <CardDescription>{t('views.reports.agentPerformance.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {agentPerformance.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-slate-400 dark:text-slate-500">
                <AlertCircle className="h-8 w-8" />
                <p className="text-xs">{t('views.reports.agentPerformance.empty')}</p>
              </div>
            ) : (
              <DataTable data={agentPerformance} columns={agentColumns} keyExtractor={(row) => row.id} embedded />
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
