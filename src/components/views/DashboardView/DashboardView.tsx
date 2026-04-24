import React, { useMemo } from 'react';
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
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { units, payments, contracts, tenants } from '@/lib/mockData';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { Contract, Payment } from '@/types';
import { useDateRange } from '@/context/DateRangeContext';
import { useAuth } from '@/context/AuthContext';

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
    <Card className="border border-slate-200/80 shadow-sm bg-white hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', iconBg)}>
            {icon}
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">{label}</p>
        <div className={cn(
          'flex items-center gap-1 mt-3 text-xs font-medium',
          subtextVariant === 'up' && 'text-emerald-600',
          subtextVariant === 'down' && 'text-rose-500',
          subtextVariant === 'alert' && 'text-rose-500',
          subtextVariant === 'neutral' && 'text-slate-400',
        )}>
          {subtextVariant === 'up' && <ArrowUpRight className="w-3 h-3" />}
          {subtextVariant === 'down' && <ArrowDownRight className="w-3 h-3" />}
          {subtextVariant === 'alert' && <AlertCircle className="w-3 h-3" />}
          {subtext}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const { t, i18n } = useTranslation();
  const { dateRange } = useDateRange();
  const { session } = useAuth();

  const firstName = session?.user?.firstName ?? 'there';
  const greeting = getGreeting();
  const today = new Date().toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

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
  const availableUnits = units.filter(u => u.status === 'Available').length;
  const vacancyRate = ((availableUnits / units.length) * 100).toFixed(1);
  const overduePayments = payments.filter(p => p.status === 'Overdue').length;
  const baseMonthlyRentProfit = contracts.reduce((sum, contract) => sum + contract.monthlyRent, 0);

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
      { id: 'dash-a1', name: 'Maria Santos', deals: 14, profit: 420000, status: t('views.dashboard.agents.statusTopPerformer') },
      { id: 'dash-a2', name: 'Juan Dela Cruz', deals: 9, profit: 280000, status: t('views.dashboard.agents.statusActive') },
      { id: 'dash-a3', name: 'Elena Reyes', deals: 6, profit: 195000, status: t('views.dashboard.agents.statusActive') },
      { id: 'dash-a4', name: 'Ricardo Gomez', deals: 3, profit: 90000, status: t('views.dashboard.agents.statusOnProbation') },
    ],
    [t]
  );

  const agentColumns: ColumnDef<AgentRow>[] = useMemo(
    () => [
      {
        header: t('views.dashboard.agents.agentName'),
        render: (a) => (
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
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
    [t]
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {greeting.icon}
            <span className="text-sm font-medium text-slate-500">{greeting.text},</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{firstName} 👋</h1>
          <p className="text-slate-400 text-sm mt-1">{today}</p>
        </div>
        <Badge variant="outline" className="px-3 py-1.5 bg-white border-slate-200 text-slate-500 self-start sm:self-auto">
          <CalendarIcon className="w-3 h-3 mr-2 shrink-0" />
          <span className="truncate text-xs">{rangeLabel}</span>
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label={t('views.dashboard.cards.totalProfit')}
          value={`₱${totalProfit.toLocaleString()}`}
          subtext={t('views.dashboard.cards.profitTrend')}
          subtextVariant="up"
          iconBg="bg-indigo-50"
          icon={<DollarSign className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          label={t('views.dashboard.cards.netProfit')}
          value={`₱${baseMonthlyRentProfit.toLocaleString()}`}
          subtext={t('views.dashboard.cards.netProfitHint')}
          subtextVariant="neutral"
          iconBg="bg-violet-50"
          icon={<TrendingUp className="w-5 h-5 text-violet-600" />}
        />
        <StatCard
          label={t('views.dashboard.cards.activeLeases')}
          value={activeContracts}
          subtext={t('views.dashboard.cards.activeTrend')}
          subtextVariant="up"
          iconBg="bg-emerald-50"
          icon={<Users className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          label={t('views.dashboard.cards.vacancyRate')}
          value={`${vacancyRate}%`}
          subtext={`${availableUnits} ${availableUnits === 1 ? 'unit' : 'units'} available`}
          subtextVariant="down"
          iconBg="bg-amber-50"
          icon={<Building2 className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          label={t('views.dashboard.cards.overdueRent')}
          value={overduePayments}
          subtext={t('views.dashboard.cards.overdueHint')}
          subtextVariant={overduePayments > 0 ? 'alert' : 'neutral'}
          iconBg="bg-rose-50"
          icon={<AlertCircle className="w-5 h-5 text-rose-500" />}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('views.dashboard.charts.salesTitle')}</CardTitle>
            <CardDescription>{t('views.dashboard.charts.salesDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `₱${val / 1000}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px -2px rgb(0 0 0 / 0.12)', fontSize: 13 }}
                  cursor={{ fill: '#f8fafc' }}
                  formatter={(val: number) => [`₱${val.toLocaleString()}`, t('views.dashboard.charts.profitLabel')]}
                />
                <Bar dataKey="Profit" fill="#4f46e5" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('views.dashboard.charts.unitStatusTitle')}</CardTitle>
            <CardDescription>{t('views.dashboard.charts.unitStatusDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={occupancyData(t)}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {occupancyData(t).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px -2px rgb(0 0 0 / 0.12)', fontSize: 13 }}
                  formatter={(val: number, name: string) => [val, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
              {occupancyData(t).map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index] }} />
                  <span>{entry.name}</span>
                  <span className="font-semibold text-slate-700">{entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="gap-0 overflow-hidden border border-slate-200/80 py-0 shadow-sm">
          <CardHeader className="border-b border-slate-100 px-6 pt-5 pb-4">
            <CardTitle className="text-base">{t('views.dashboard.vacancies.title')}</CardTitle>
            <CardDescription>{t('views.dashboard.vacancies.description')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {vacancyContracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
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

        <Card className="gap-0 overflow-hidden border border-slate-200/80 py-0 shadow-sm">
          <CardHeader className="border-b border-slate-100 px-6 pt-5 pb-4">
            <CardTitle className="text-base">{t('views.dashboard.payments.title')}</CardTitle>
            <CardDescription>{t('views.dashboard.payments.description')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingPayments7Days.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <CalendarIcon className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">No upcoming payments this week 🎉</p>
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

        <Card className="gap-0 overflow-hidden border border-slate-200/80 py-0 shadow-sm lg:col-span-2">
          <CardHeader className="border-b border-slate-100 px-6 pt-5 pb-4">
            <CardTitle className="text-base">{t('views.dashboard.agents.title')}</CardTitle>
            <CardDescription>{t('views.dashboard.agents.description')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              data={agentRows}
              columns={agentColumns}
              keyExtractor={(a) => a.id}
              embedded
              highlightFirstColumn={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
