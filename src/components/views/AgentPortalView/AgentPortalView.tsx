import React from 'react';
import { Briefcase, TrendingUp, Users, CalendarDays, PhoneCall, FileText, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { agents, contracts, tenants, units } from '@/lib/mockData';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

export function AgentPortalView() {
  const { t } = useTranslation();
  const agent = agents[0];
  const assignedContracts = contracts.filter((c) => c.agentId === agent?.id);

  return (
    <div className="min-h-screen bg-slate-50 animate-in fade-in duration-500">
      <div className="bg-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Briefcase className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{t('views.agentPortal.welcome', { name: agent?.name ?? 'Agent' })}</h1>
              <p className="text-indigo-100">{t('views.agentPortal.subtitle')}</p>
            </div>
          </div>
          <Button className="bg-white text-indigo-600 hover:bg-indigo-50">
            <PhoneCall className="w-4 h-4 mr-2" />
            {t('views.agentPortal.contactManagement')}
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-none shadow-sm bg-emerald-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    {t('views.agentPortal.stats.activeDeals')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold text-emerald-900">{assignedContracts.length}</CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-sky-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-sky-700 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('views.agentPortal.stats.clients')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold text-sky-900">
                  {new Set(assignedContracts.map((c) => c.tenantId)).size}
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-amber-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-amber-700 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" />
                    {t('views.agentPortal.stats.upcomingRenewals')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold text-amber-900">
                  {assignedContracts.filter((c) => c.status === 'Active').length}
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle>{t('views.agentPortal.contracts.title')}</CardTitle>
                <CardDescription>{t('views.agentPortal.contracts.description')}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('views.agentPortal.contracts.unit')}</TableHead>
                      <TableHead>{t('views.agentPortal.contracts.tenant')}</TableHead>
                      <TableHead>{t('views.agentPortal.contracts.endDate')}</TableHead>
                      <TableHead>{t('views.agentPortal.contracts.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedContracts.map((contract) => {
                      const unit = units.find((u) => u.id === contract.unitId);
                      const tenant = tenants.find((x) => x.id === contract.tenantId);
                      return (
                        <TableRow key={contract.id}>
                          <TableCell>{unit?.unitNumber}</TableCell>
                          <TableCell>{tenant?.name}</TableCell>
                          <TableCell>{format(new Date(contract.endDate), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant={contract.status === 'Active' ? 'default' : 'outline'}>
                              {contract.status === 'Active' ? t('views.agentPortal.contracts.active') : contract.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle>{t('views.agentPortal.tasks.title')}</CardTitle>
                <CardDescription>{t('views.agentPortal.tasks.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {['followUps', 'scheduleVisits', 'sendProposals'].map((taskKey) => (
                  <div key={taskKey} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      {t(`views.agentPortal.tasks.${taskKey}`)}
                    </div>
                    <Badge variant="outline">{t('views.agentPortal.tasks.today')}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle>{t('views.agentPortal.docs.title')}</CardTitle>
                <CardDescription>{t('views.agentPortal.docs.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {['contractTemplates', 'rateCards', 'policyGuide'].map((docKey) => (
                  <div key={docKey} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-slate-400" />
                      {t(`views.agentPortal.docs.${docKey}`)}
                    </div>
                    <Button variant="ghost" size="sm">{t('views.agentPortal.docs.open')}</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
