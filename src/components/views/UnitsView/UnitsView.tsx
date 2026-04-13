import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  Building2, 
  MapPin,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { units } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Unit } from '@/types';
import { useTranslation } from 'react-i18next';

export function UnitsView() {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const handleViewDetails = (unit: Unit) => {
    setSelectedUnit(unit);
    setIsDetailsOpen(true);
  };

  const filteredUnits = units.filter(u => 
    u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.buildingName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.area.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusLabel = (status: string) => {
    if (status === 'Available') return t('views.units.statuses.available');
    if (status === 'Occupied') return t('views.units.statuses.occupied');
    return t('views.units.statuses.maintenance');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.units.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.units.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setViewMode('list')} className={cn(viewMode === 'list' && "bg-slate-100")}>
            <ListIcon className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setViewMode('grid')} className={cn(viewMode === 'grid' && "bg-slate-100")}>
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            {t('views.units.addUnit')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder={t('views.units.searchPlaceholder')}
            className="pl-10 border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="w-full sm:w-auto">
          <Filter className="w-4 h-4 mr-2" />
          {t('views.units.filter')}
        </Button>
      </div>

      {viewMode === 'list' ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-[100px]">{t('views.units.table.unit')}</TableHead>
                  <TableHead>{t('views.units.table.building')}</TableHead>
                  <TableHead>{t('views.units.table.area')}</TableHead>
                  <TableHead>{t('views.units.table.type')}</TableHead>
                  <TableHead>{t('views.units.table.status')}</TableHead>
                  <TableHead>{t('views.units.table.monthlyRate')}</TableHead>
                  <TableHead className="text-right">{t('views.units.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnits.map((unit) => (
                  <TableRow key={unit.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-bold text-slate-900">{unit.unitNumber}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700">{unit.buildingName}</span>
                        <span className="text-xs text-slate-500">{unit.tower}, {t('views.units.table.floor')} {unit.floor}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-slate-600">
                        <MapPin className="w-3 h-3" />
                        {unit.area}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">{unit.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={unit.status === 'Available' ? 'default' : unit.status === 'Occupied' ? 'secondary' : 'outline'}
                        className={cn(
                          "font-medium",
                          unit.status === 'Available' && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
                          unit.status === 'Occupied' && "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
                          unit.status === 'Maintenance' && "bg-rose-100 text-rose-700 hover:bg-rose-100"
                        )}
                      >
                        {statusLabel(unit.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">₱{unit.monthlyRate.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                          <MoreVertical className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(unit)}>{t('views.units.table.viewDetails')}</DropdownMenuItem>
                          <DropdownMenuItem>{t('views.units.table.editUnit')}</DropdownMenuItem>
                          <DropdownMenuItem>{t('views.units.table.manageInventory')}</DropdownMenuItem>
                          <DropdownMenuItem className="text-rose-600">{t('views.units.table.delete')}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUnits.map((unit) => (
            <Card key={unit.id} className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all group">
              <div className="h-32 bg-slate-100 relative">
                <div className="absolute top-3 right-3">
                  <Badge 
                    className={cn(
                      unit.status === 'Available' ? "bg-emerald-500" : 
                      unit.status === 'Occupied' ? "bg-indigo-500" : "bg-slate-500"
                    )}
                  >
                    {statusLabel(unit.status)}
                  </Badge>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  <Building2 className="w-16 h-16" />
                </div>
              </div>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{t('views.units.unitLabel', { unitNumber: unit.unitNumber })}</h3>
                    <p className="text-sm text-slate-500">{unit.buildingName}</p>
                  </div>
                  <p className="text-lg font-bold text-indigo-600">₱{unit.monthlyRate.toLocaleString()}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <MapPin className="w-3 h-3" />
                    {unit.area}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <LayoutGrid className="w-3 h-3" />
                    {unit.type}
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full group-hover:bg-indigo-600 group-hover:text-white transition-colors"
                  onClick={() => handleViewDetails(unit)}
                >
                  {t('views.units.table.viewDetails')}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-2xl font-bold">{t('views.units.unitLabel', { unitNumber: selectedUnit?.unitNumber })}</DialogTitle>
                <DialogDescription>{selectedUnit?.buildingName} • {selectedUnit?.tower}</DialogDescription>
              </div>
              <Badge 
                className={cn(
                  selectedUnit?.status === 'Available' ? "bg-emerald-500" : 
                  selectedUnit?.status === 'Occupied' ? "bg-indigo-500" : "bg-slate-500"
                )}
              >
                {selectedUnit?.status ? statusLabel(selectedUnit.status) : ''}
              </Badge>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-8">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{t('views.units.details.monthlyRate')}</p>
                  <p className="text-lg font-bold text-slate-900">₱{selectedUnit?.monthlyRate.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{t('views.units.details.unitType')}</p>
                  <p className="text-lg font-bold text-slate-900">{selectedUnit?.type}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{t('views.units.table.area')}</p>
                  <p className="text-lg font-bold text-slate-900">{selectedUnit?.area}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-indigo-600" />
                  {t('views.units.details.inventoryAssets')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { item: 'Air Conditioning Unit', qty: 1, condition: 'Good' },
                    { item: 'Refrigerator', qty: 1, condition: 'Good' },
                    { item: 'Microwave', qty: 1, condition: 'Good' },
                    { item: 'Bed Frame', qty: 1, condition: 'Good' },
                    { item: 'Dining Table', qty: 1, condition: 'Good' },
                    { item: 'Chairs', qty: 4, condition: 'Good' },
                  ].map((inv, i) => (
                    <div key={i} className="flex items-center justify-between p-2 text-sm border-b border-slate-100">
                      <span className="text-slate-700">{inv.item} ({inv.qty})</span>
                      <Badge variant="outline" className="text-[10px] h-5">{t('views.units.details.good')}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  {t('views.units.details.legalAddress')}
                </h4>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600 leading-relaxed">
                  {t('views.units.details.addressTemplate', {
                    unitNumber: selectedUnit?.unitNumber,
                    tower: selectedUnit?.tower,
                    buildingName: selectedUnit?.buildingName,
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-2 text-slate-500">
                  <History className="w-4 h-4" />
                  {t('views.units.details.historicalTenants')}
                </h4>
                <div className="space-y-2">
                  {[
                    { name: 'Alice Guo', period: 'Jan 2024 - Jan 2025', status: 'Completed' },
                    { name: 'David Sy', period: 'Jan 2023 - Jan 2024', status: 'Completed' },
                  ].map((hist, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-lg border border-slate-100 text-xs">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{hist.name}</span>
                        <span className="text-slate-400">{hist.period}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{t('views.units.details.completed')}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-2 text-amber-600">
                  <Plus className="w-4 h-4" />
                  {t('views.units.details.specialRequests')}
                </h4>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-900 italic">
                  {t('views.units.details.remarksText')}
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <div className="p-6 border-t bg-slate-50/50 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>{t('views.units.details.close')}</Button>
            <Button className="bg-indigo-600">{t('views.units.details.editUnitInfo')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
