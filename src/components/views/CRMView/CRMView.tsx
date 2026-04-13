import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  ShieldCheck, 
  ShieldAlert,
  FileText,
  History,
  MoreVertical,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { tenants, brokerAgencies, contracts, units } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function CRMView() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.crm.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.crm.subtitle')}</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          {t('views.crm.registerTenant')}
        </Button>
      </div>

      <Tabs defaultValue="tenants" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3 mb-6">
          <TabsTrigger value="tenants">{t('views.crm.tabs.tenants')}</TabsTrigger>
          <TabsTrigger value="brokers">{t('views.crm.tabs.brokers')}</TabsTrigger>
          <TabsTrigger value="blacklist">{t('views.crm.tabs.blacklist')}</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder={t('views.crm.searchPlaceholder')}
                className="pl-10 border-slate-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card className="border-none shadow-md">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead>{t('views.crm.table.tenant')}</TableHead>
                      <TableHead>{t('views.crm.table.contactInfo')}</TableHead>
                      <TableHead>{t('views.crm.table.kycStatus')}</TableHead>
                      <TableHead>{t('views.crm.table.currentUnit')}</TableHead>
                      <TableHead>{t('views.crm.table.status')}</TableHead>
                      <TableHead className="text-right">{t('views.crm.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => {
                      const activeContract = contracts.find(c => c.tenantId === tenant.id && c.status === 'Active');
                      const unit = activeContract ? units.find(u => u.id === activeContract.unitId) : null;
                      
                      return (
                        <TableRow key={tenant.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback>{tenant.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900">{tenant.name}</span>
                                <span className="text-xs text-slate-500">{t('views.crm.table.idLabel', { id: tenant.idNumber })}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Mail className="w-3 h-3" />
                                {tenant.email}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Phone className="w-3 h-3" />
                                {tenant.phone}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              {t('views.crm.table.verified')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {unit ? (
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-700">{t('views.crm.table.unitLabel', { unitNumber: unit.unitNumber })}</span>
                                <span className="text-xs text-slate-500">{unit.buildingName}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">{t('views.crm.table.noActiveLease')}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {tenant.isBlacklisted ? (
                              <Badge variant="destructive">{t('views.crm.table.blacklisted')}</Badge>
                            ) : (
                              <Badge variant="default" className="bg-indigo-500">{t('views.crm.table.active')}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" title={t('views.crm.table.viewPortal')}>
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title={t('views.crm.table.history')}>
                                <History className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="brokers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brokerAgencies.map((agency) => (
              <Card key={agency.id} className="border-none shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                      <Users className="w-6 h-6" />
                    </div>
                    <Badge variant="outline">{t('views.crm.brokers.partner')}</Badge>
                  </div>
                  <CardTitle className="mt-4">{agency.name}</CardTitle>
                  <CardDescription>{t('views.crm.brokers.officialPartner')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{t('views.crm.brokers.contactPerson')}</span>
                      <span className="font-medium">{agency.contactPerson}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{t('views.crm.brokers.phone')}</span>
                      <span className="font-medium">{agency.phone}</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full">{t('views.crm.brokers.viewLogs')}</Button>
                </CardContent>
              </Card>
            ))}
            <Card className="border-dashed border-2 flex flex-col items-center justify-center p-6 text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all cursor-pointer">
              <Plus className="w-8 h-8 mb-2" />
              <p className="font-medium">{t('views.crm.brokers.addAgency')}</p>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="blacklist" className="space-y-6">
          <Card className="border-none shadow-md border-rose-100">
            <CardHeader className="bg-rose-50/50 border-b border-rose-100">
              <CardTitle className="text-rose-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                {t('views.crm.blacklist.title')}
              </CardTitle>
              <CardDescription className="text-rose-700/70">
                {t('views.crm.blacklist.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="pl-6">{t('views.crm.blacklist.name')}</TableHead>
                    <TableHead>{t('views.crm.blacklist.type')}</TableHead>
                    <TableHead>{t('views.crm.blacklist.reason')}</TableHead>
                    <TableHead>{t('views.crm.blacklist.dateAdded')}</TableHead>
                    <TableHead className="text-right pr-6">{t('views.crm.blacklist.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { name: 'Robert Wilson', type: 'Tenant', reason: 'Unpaid rent for 3 months & property damage', date: '2025-11-12' },
                    { name: 'Sarah Jenkins', type: 'Landlord', reason: 'Multiple security deposit refund violations', date: '2026-01-05' },
                    { name: 'Kevin Lee', type: 'Tenant', reason: 'Illegal subletting and noise complaints', date: '2025-08-20' },
                  ].map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-bold pl-6">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(item.type === 'Tenant' ? "text-blue-600 border-blue-100 bg-blue-50" : "text-amber-600 border-amber-100 bg-amber-50")}>
                          {item.type === 'Tenant' ? t('views.crm.blacklist.tenant') : t('views.crm.blacklist.landlord')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{item.reason}</TableCell>
                      <TableCell className="text-xs text-slate-400">Nov 12, 2025</TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" className="text-rose-600">{t('views.crm.blacklist.details')}</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
