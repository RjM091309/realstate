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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { units, payments, contracts, tenants } from '@/lib/mockData';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const [profitOverride, setProfitOverride] = useState<string>('');
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

  const upcomingVacancies = contracts.filter(c => {
    const end = new Date(c.endDate);
    const thirtyDaysFromNow = addDays(new Date(), 30);
    return isBefore(end, thirtyDaysFromNow) && isAfter(end, new Date());
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.dashboard.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="outline" className="px-3 py-1 bg-white">
            <CalendarIcon className="w-3 h-3 mr-2" />
            {t('views.dashboard.last30Days')}
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
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('views.dashboard.vacancies.unit')}</TableHead>
                  <TableHead>{t('views.dashboard.vacancies.tenant')}</TableHead>
                  <TableHead>{t('views.dashboard.vacancies.expiryDate')}</TableHead>
                  <TableHead className="text-right">{t('views.dashboard.vacancies.notice')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts
                  .filter(c => isBefore(new Date(c.endDate), addDays(new Date(), 60)))
                  .map((c) => {
                    const unit = units.find(u => u.id === c.unitId);
                    const tenant = tenants.find(t => t.id === c.tenantId);
                    const daysLeft = Math.ceil((new Date(c.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{unit?.unitNumber} - {unit?.buildingName}</TableCell>
                        <TableCell>{tenant?.name || t('views.dashboard.vacancies.fallbackTenant')}</TableCell>
                        <TableCell>{format(new Date(c.endDate), 'MMM dd, yyyy')}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={daysLeft <= 30 ? 'destructive' : 'outline'}>
                            {daysLeft <= 30 ? t('views.dashboard.vacancies.oneMonth') : t('views.dashboard.vacancies.twoMonth')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle>{t('views.dashboard.payments.title')}</CardTitle>
            <CardDescription>{t('views.dashboard.payments.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('views.dashboard.payments.unit')}</TableHead>
                  <TableHead>{t('views.dashboard.payments.tenant')}</TableHead>
                  <TableHead>{t('views.dashboard.payments.dueDate')}</TableHead>
                  <TableHead className="text-right">{t('views.dashboard.payments.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingPayments7Days.length > 0 ? (
                  upcomingPayments7Days.map((payment) => {
                    const unit = units.find((u) => u.id === payment.unitId);
                    const contract = contracts.find((c) => c.id === payment.contractId);
                    const tenant = contract ? tenants.find((t) => t.id === contract.tenantId) : null;
                    return (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{unit?.unitNumber} - {unit?.buildingName}</TableCell>
                        <TableCell>{tenant?.name}</TableCell>
                        <TableCell>{format(new Date(payment.dueDate), 'MMM dd, yyyy')}</TableCell>
                        <TableCell className="text-right font-semibold">₱{payment.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">{t('views.dashboard.payments.empty')}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('views.dashboard.agents.title')}</CardTitle>
            <CardDescription>{t('views.dashboard.agents.description')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="pl-6">{t('views.dashboard.agents.agentName')}</TableHead>
                  <TableHead className="text-center">{t('views.dashboard.agents.deals')}</TableHead>
                  <TableHead className="text-right">{t('views.dashboard.agents.profit')}</TableHead>
                  <TableHead className="text-right pr-6">{t('views.dashboard.agents.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { name: 'Maria Santos', deals: 14, Profit: 420000, status: t('views.dashboard.agents.statusTopPerformer') },
                  { name: 'Juan Dela Cruz', deals: 9, Profit: 280000, status: t('views.dashboard.agents.statusActive') },
                  { name: 'Elena Reyes', deals: 6, Profit: 195000, status: t('views.dashboard.agents.statusActive') },
                  { name: 'Ricardo Gomez', deals: 3, Profit: 90000, status: t('views.dashboard.agents.statusOnProbation') },
                ].map((agent, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium pl-6">{agent.name}</TableCell>
                    <TableCell className="text-center">{agent.deals}</TableCell>
                    <TableCell className="text-right font-mono text-xs">₱{agent.Profit.toLocaleString()}</TableCell>
                    <TableCell className="text-right pr-6">
                      <Badge
                        variant={agent.status === t('views.dashboard.agents.statusTopPerformer') ? 'default' : 'outline'}
                        className={cn(agent.status === t('views.dashboard.agents.statusTopPerformer') && "bg-indigo-600")}
                      >
                        {agent.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
