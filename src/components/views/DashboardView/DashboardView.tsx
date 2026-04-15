import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  Users, 
  Building2, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Calendar as CalendarIcon
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { units, payments, contracts, tenants } from '@/lib/mockData';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { Contract, Payment } from '@/types';
import { useDateRange } from '@/context/DateRangeContext';

const salesData = [
  { month: 'Jan', Profit: 450000, deals: 12 },
  { month: 'Feb', Profit: 520000, deals: 15 },
  { month: 'Mar', Profit: 480000, deals: 10 },
  { month: 'Apr', Profit: 610000, deals: 18 },
  { month: 'May', Profit: 550000, deals: 14 },
  { month: 'Jun', Profit: 670000, deals: 20 },
];

const occupancyData = (t: (key: string) => string) => [
  { name: t('views.dashboard.charts.statuses.occupied'), value: units.filter(u => u.status === 'Occupied').length },
  { name: t('views.dashboard.charts.statuses.available'), value: units.filter(u => u.status === 'Available').length },
  { name: t('views.dashboard.charts.statuses.maintenance'), value: units.filter(u => u.status === 'Maintenance').length },
];

const COLORS = ['#4f46e5', '#10b981', '#f59e0b'];

export function DashboardView() {
  const { t, i18n } = useTranslation();
  const { dateRange } = useDateRange();
  const [profitOverride, setProfitOverride] = useState<string>('');

  const rangeLabel =
    dateRange.start && dateRange.end
      ? `${new Date(dateRange.start + 'T12:00:00').toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })} – ${new Date(dateRange.end + 'T12:00:00').toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`
      : t('views.dashboard.last30Days');
  const totalProfit = salesData.reduce((acc, curr) => acc + curr.Profit, 0);
  const activeContracts = contracts.filter(c => c.status === 'Active').length;
  const vacancyRate = ((units.filter(u => u.status === 'Available').length / units.length) * 100).toFixed(1);
  const overduePayments = payments.filter(p => p.status === 'Overdue').length;
  const baseMonthlyRentProfit = contracts.reduce((sum, contract) => sum + contract.monthlyRent, 0);
  const parsedOverride = Number(profitOverride);
  const computedNetProfit = useMemo(() => {
    if (profitOverride.trim() === '') return baseMonthlyRentProfit;
    return Number.isFinite(parsedOverride) ? parsedOverride : baseMonthlyRentProfit;
  }, [baseMonthlyRentProfit, parsedOverride, profitOverride]);
  const upcomingPayments7Days = payments
    .filter((payment) => {
      const due = new Date(payment.dueDate);
      return payment.status !== 'Paid' && isAfter(due, new Date()) && isBefore(due, addDays(new Date(), 8));
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const vacancyContracts = useMemo(
    () => contracts.filter((c) => isBefore(new Date(c.endDate), addDays(new Date(), 60))),
    []
  );

  const vacancyColumns: ColumnDef<Contract>[] = useMemo(
    () => [
      {
        header: t('views.dashboard.vacancies.unit'),
        render: (c) => {
          const unit = units.find((u) => u.id === c.unitId);
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
          const tenant = tenants.find((ten) => ten.id === c.tenantId);
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
            <Badge variant={daysLeft <= 30 ? 'destructive' : 'outline'}>
              {daysLeft <= 30 ? t('views.dashboard.vacancies.oneMonth') : t('views.dashboard.vacancies.twoMonth')}
            </Badge>
          );
        },
      },
    ],
    [t]
  );

  const paymentColumns: ColumnDef<Payment>[] = useMemo(
    () => [
      {
        header: t('views.dashboard.payments.unit'),
        render: (payment) => {
          const unit = units.find((u) => u.id === payment.unitId);
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
          const contract = contracts.find((c) => c.id === payment.contractId);
          const tenant = contract ? tenants.find((ten) => ten.id === contract.tenantId) : null;
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
        render: (payment) => (
          <span className="font-semibold">₱{payment.amount.toLocaleString()}</span>
        ),
      },
    ],
    [t]
  );

  type AgentRow = { id: string; name: string; deals: number; profit: number; status: string };
  const agentRows: AgentRow[] = useMemo(
    () => [
      {
        id: 'dash-a1',
        name: 'Maria Santos',
        deals: 14,
        profit: 420000,
        status: t('views.dashboard.agents.statusTopPerformer'),
      },
      {
        id: 'dash-a2',
        name: 'Juan Dela Cruz',
        deals: 9,
        profit: 280000,
        status: t('views.dashboard.agents.statusActive'),
      },
      {
        id: 'dash-a3',
        name: 'Elena Reyes',
        deals: 6,
        profit: 195000,
        status: t('views.dashboard.agents.statusActive'),
      },
      {
        id: 'dash-a4',
        name: 'Ricardo Gomez',
        deals: 3,
        profit: 90000,
        status: t('views.dashboard.agents.statusOnProbation'),
      },
    ],
    [t]
  );

  const agentColumns: ColumnDef<AgentRow>[] = useMemo(
    () => [
      {
        header: t('views.dashboard.agents.agentName'),
        render: (a) => <span className="font-medium pl-0">{a.name}</span>,
      },
      {
        header: t('views.dashboard.agents.deals'),
        className: 'text-center',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (a) => <span>{a.deals}</span>,
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
    [t]
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.dashboard.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="outline" className="px-3 py-1 bg-white max-w-full truncate">
            <CalendarIcon className="w-3 h-3 mr-2 shrink-0" />
            <span className="truncate">{rangeLabel}</span>
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <Card className="border-none shadow-md bg-indigo-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium opacity-80">{t('views.dashboard.cards.totalProfit')}</CardTitle>
            <DollarSign className="w-4 h-4 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{totalProfit.toLocaleString()}</div>
            <p className="text-xs mt-1 flex items-center opacity-80">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              {t('views.dashboard.cards.profitTrend')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">{t('views.dashboard.cards.netProfit')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold text-slate-900">₱{computedNetProfit.toLocaleString()}</div>
            <Input
              type="number"
              min="0"
              value={profitOverride}
              onChange={(e) => setProfitOverride(e.target.value)}
              placeholder={t('views.dashboard.cards.defaultProfit', { amount: baseMonthlyRentProfit.toLocaleString() })}
              className="h-8 text-xs"
            />
            <p className="text-xs text-slate-500">{t('views.dashboard.cards.netProfitHint')}</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">{t('views.dashboard.cards.activeLeases')}</CardTitle>
            <Users className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{activeContracts}</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-1 text-emerald-500" />
              {t('views.dashboard.cards.activeTrend')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">{t('views.dashboard.cards.vacancyRate')}</CardTitle>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{vacancyRate}%</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center">
              <ArrowDownRight className="w-3 h-3 mr-1 text-rose-500" />
              {t('views.dashboard.cards.vacancyTrend')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">{t('views.dashboard.cards.overdueRent')}</CardTitle>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{overduePayments}</div>
            <p className="text-xs text-rose-500 mt-1 font-medium">
              {t('views.dashboard.cards.overdueHint')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-md">
          <CardHeader>
            <CardTitle>{t('views.dashboard.charts.salesTitle')}</CardTitle>
            <CardDescription>{t('views.dashboard.charts.salesDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `₱${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: number) => [`₱${val.toLocaleString()}`, t('views.dashboard.charts.profitLabel')]}
                />
                <Bar dataKey="Profit" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle>{t('views.dashboard.charts.unitStatusTitle')}</CardTitle>
            <CardDescription>{t('views.dashboard.charts.unitStatusDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={occupancyData(t)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {occupancyData(t).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-4 text-xs font-medium text-slate-500">
              {occupancyData(t).map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index]}}></div>
                  {entry.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Vacancies, Upcoming Payments & Agent Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle>{t('views.dashboard.vacancies.title')}</CardTitle>
            <CardDescription>{t('views.dashboard.vacancies.description')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-hidden rounded-b-xl">
            <DataTable data={vacancyContracts} columns={vacancyColumns} keyExtractor={(c) => c.id} />
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle>{t('views.dashboard.payments.title')}</CardTitle>
            <CardDescription>{t('views.dashboard.payments.description')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-hidden rounded-b-xl">
            <DataTable
              data={upcomingPayments7Days}
              columns={paymentColumns}
              keyExtractor={(p) => p.id}
            />
          </CardContent>
        </Card>

        <Card className="border-none shadow-md lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('views.dashboard.agents.title')}</CardTitle>
            <CardDescription>{t('views.dashboard.agents.description')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-hidden rounded-b-xl">
            <DataTable data={agentRows} columns={agentColumns} keyExtractor={(a) => a.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
