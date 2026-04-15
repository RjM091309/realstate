import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
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
  History,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { Select2 } from '@/components/ui/select2';
import { units as seedUnits } from '@/lib/mockData';
import { createUnit, deleteUnit, fetchUnits, updateUnit, type UnitWriteBody } from '@/lib/unitsApi';
import { cn } from '@/lib/utils';
import type { Unit, UnitStatus, UnitType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';

const UNIT_TYPES: UnitType[] = ['Studio', '1BR', '2BR', '3BR', 'Loft', 'Penthouse'];
const UNIT_STATUSES: UnitStatus[] = ['Available', 'Occupied', 'Maintenance', 'Reserved'];
const AREAS: Unit['area'][] = ['Makati', 'BGC', 'Pasig', 'Quezon City'];

type AddUnitForm = {
  unitNumber: string;
  floor: string;
  tower: string;
  buildingName: string;
  commonAddress: string;
  legalAddress: string;
  type: UnitType;
  status: UnitStatus;
  area: Unit['area'];
  monthlyRate: string;
};

function defaultAddForm(): AddUnitForm {
  return {
    unitNumber: '',
    floor: '',
    tower: '',
    buildingName: '',
    commonAddress: '',
    legalAddress: '',
    type: '1BR',
    status: 'Available',
    area: 'Makati',
    monthlyRate: '',
  };
}

function formToWriteBody(form: AddUnitForm, inventory: Unit['inventory']): UnitWriteBody {
  const rate = Number(String(form.monthlyRate).replace(/,/g, ''));
  return {
    unitNumber: form.unitNumber.trim(),
    floor: form.floor.trim() || '—',
    tower: form.tower.trim() || '—',
    buildingName: form.buildingName.trim(),
    commonAddress: form.commonAddress.trim() || form.buildingName.trim(),
    legalAddress: form.legalAddress.trim() || form.commonAddress.trim() || '—',
    type: form.type,
    status: form.status,
    area: form.area,
    monthlyRate: rate,
    inventory,
  };
}

function unitToForm(u: Unit): AddUnitForm {
  return {
    unitNumber: u.unitNumber,
    floor: u.floor === '—' ? '' : u.floor,
    tower: u.tower === '—' ? '' : u.tower,
    buildingName: u.buildingName,
    commonAddress: u.commonAddress,
    legalAddress: u.legalAddress,
    type: u.type,
    status: u.status,
    area: u.area,
    monthlyRate: String(u.monthlyRate),
  };
}

export function UnitsView() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const canCreate = session?.crud?.units?.create ?? false;
  const canUpdate = session?.crud?.units?.update ?? false;
  const canDelete = session?.crud?.units?.delete ?? false;

  const [unitList, setUnitList] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddUnitForm>(defaultAddForm);

  const reloadUnits = useCallback(async () => {
    try {
      const units = await fetchUnits();
      setUnitList(units);
    } catch {
      setUnitList([...seedUnits]);
      toast.warning(t('views.units.loadError'));
    } finally {
      setUnitsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reloadUnits();
  }, [reloadUnits]);

  const handleViewDetails = (unit: Unit) => {
    setSelectedUnit(unit);
    setIsDetailsOpen(true);
  };

  const filteredUnits = unitList.filter(
    (u) =>
      u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.buildingName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.area.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusLabel = (status: string) => {
    if (status === 'Available') return t('views.units.statuses.available');
    if (status === 'Occupied') return t('views.units.statuses.occupied');
    if (status === 'Maintenance') return t('views.units.statuses.maintenance');
    if (status === 'Reserved') return t('views.units.statuses.reserved');
    return t('views.units.statuses.maintenance');
  };

  const openAddUnitModal = () => {
    setIsDetailsOpen(false);
    setFormMode('create');
    setEditingId(null);
    setAddForm(defaultAddForm());
    setIsAddUnitOpen(true);
  };

  const openEditUnitModal = (unit: Unit) => {
    setIsDetailsOpen(false);
    setFormMode('edit');
    setEditingId(unit.id);
    setAddForm(unitToForm(unit));
    setIsAddUnitOpen(true);
  };

  const closeAddUnitModal = () => {
    setIsAddUnitOpen(false);
    setFormMode('create');
    setEditingId(null);
    setAddForm(defaultAddForm());
  };

  const handleSaveUnit = async () => {
    const rate = Number(String(addForm.monthlyRate).replace(/,/g, ''));
    if (!addForm.unitNumber.trim() || !addForm.buildingName.trim()) {
      toast.error(t('views.units.addModal.validationRequired'));
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error(t('views.units.addModal.validationRate'));
      return;
    }
    const existingInventory =
      formMode === 'edit' && editingId
        ? (unitList.find((u) => u.id === editingId)?.inventory ?? [])
        : [];
    const body = formToWriteBody(addForm, existingInventory);
    try {
      if (formMode === 'edit' && editingId) {
        const updated = await updateUnit(editingId, body);
        setUnitList((prev) => prev.map((u) => (u.id === editingId ? updated : u)));
        setSelectedUnit((s) => (s?.id === editingId ? updated : s));
        toast.success(t('views.units.updated'));
        setIsDetailsOpen(false);
      } else {
        const created = await createUnit(body);
        setUnitList((prev) => [created, ...prev]);
        toast.success(t('views.units.addModal.saved'));
      }
      closeAddUnitModal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  const handleDeleteUnit = async (unit: Unit) => {
    if (!window.confirm(t('views.units.deleteConfirm', { unitNumber: unit.unitNumber }))) return;
    try {
      await deleteUnit(unit.id);
      setUnitList((prev) => prev.filter((u) => u.id !== unit.id));
      if (selectedUnit?.id === unit.id) {
        setSelectedUnit(null);
        setIsDetailsOpen(false);
      }
      toast.success(t('views.units.deleted'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  const addTypeOptions = useMemo(
    () => UNIT_TYPES.map((ut) => ({ value: ut, label: ut })),
    [],
  );

  const addStatusOptions = useMemo(
    () => UNIT_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
    [t, i18n.language],
  );

  const addAreaOptions = useMemo(
    () => AREAS.map((a) => ({ value: a, label: a })),
    [],
  );

  const columns: ColumnDef<Unit>[] = useMemo(
    () => [
      {
        header: t('views.units.table.unit'),
        render: (unit) => <span className="font-bold text-slate-900">{unit.unitNumber}</span>,
      },
      {
        header: t('views.units.table.building'),
        render: (unit) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-700">{unit.buildingName}</span>
            <span className="text-xs text-slate-500">
              {unit.tower}, {t('views.units.table.floor')} {unit.floor}
            </span>
          </div>
        ),
      },
      {
        header: t('views.units.table.area'),
        render: (unit) => (
          <div className="flex items-center gap-1 text-slate-600">
            <MapPin className="w-3 h-3" />
            {unit.area}
          </div>
        ),
      },
      {
        header: t('views.units.table.type'),
        render: (unit) => <Badge variant="outline" className="font-normal">{unit.type}</Badge>,
      },
      {
        header: t('views.units.table.status'),
        render: (unit) => (
          <Badge
            variant="outline"
            className={cn(
              'font-medium border-0',
              unit.status === 'Available' && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
              unit.status === 'Occupied' && 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100',
              unit.status === 'Maintenance' && 'bg-rose-100 text-rose-700 hover:bg-rose-100',
              unit.status === 'Reserved' && 'bg-amber-100 text-amber-800 hover:bg-amber-100'
            )}
          >
            {statusLabel(unit.status)}
          </Badge>
        ),
      },
      {
        header: t('views.units.table.monthlyRate'),
        render: (unit) => <span className="font-semibold">₱{unit.monthlyRate.toLocaleString()}</span>,
      },
      {
        header: t('views.units.table.actions'),
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (unit) => (
          <div
            className="inline-flex justify-end"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => e.stopPropagation()}
                  />
                }
              >
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewDetails(unit);
                  }}
                >
                  {t('views.units.table.viewDetails')}
                </DropdownMenuItem>
                {canUpdate && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditUnitModal(unit);
                    }}
                  >
                    {t('views.units.table.editUnit')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled>{t('views.units.table.manageInventory')}</DropdownMenuItem>
                {canDelete && (
                  <DropdownMenuItem
                    className="text-rose-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteUnit(unit);
                    }}
                  >
                    {t('views.units.table.delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [t, canUpdate, canDelete, statusLabel]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('views.units.title')}</h1>
          <p className="text-slate-500 mt-1">{t('views.units.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setViewMode('list')} className={cn(viewMode === 'list' && 'bg-slate-100')}>
            <ListIcon className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setViewMode('grid')} className={cn(viewMode === 'grid' && 'bg-slate-100')}>
            <LayoutGrid className="w-4 h-4" />
          </Button>
          {canCreate && (
            <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={openAddUnitModal}>
              <Plus className="w-4 h-4 mr-2" />
              {t('views.units.addUnit')}
            </Button>
          )}
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
        <Button variant="outline" className="w-full sm:w-auto shrink-0">
          <Filter className="w-4 h-4 mr-2" />
          {t('views.units.filter')}
        </Button>
      </div>

      {unitsLoading ? (
        <div className="py-24 text-center text-slate-500 text-sm">{t('common.loading')}</div>
      ) : viewMode === 'list' ? (
        <DataTable
          data={filteredUnits}
          columns={columns}
          keyExtractor={(u) => u.id}
          onRowClick={(unit) => handleViewDetails(unit)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUnits.map((unit) => (
            <Card key={unit.id} className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all group">
              <div className="h-32 bg-slate-100 relative">
                <div className="absolute top-3 right-3">
                  <Badge
                    className={cn(
                      unit.status === 'Available'
                        ? 'bg-emerald-500'
                        : unit.status === 'Occupied'
                          ? 'bg-indigo-500'
                          : unit.status === 'Maintenance'
                            ? 'bg-rose-500'
                            : unit.status === 'Reserved'
                              ? 'bg-amber-500'
                              : 'bg-slate-500'
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

      <Modal
        isOpen={isDetailsOpen && !isAddUnitOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={
          selectedUnit ? t('views.units.unitLabel', { unitNumber: selectedUnit.unitNumber }) : ''
        }
        maxWidth="4xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              {t('views.units.details.close')}
            </Button>
            {canUpdate && selectedUnit && (
              <Button
                className="bg-indigo-600"
                onClick={() => openEditUnitModal(selectedUnit)}
              >
                {t('views.units.details.editUnitInfo')}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-brand-muted">
              {selectedUnit?.buildingName} • {selectedUnit?.tower}
            </p>
          </div>
          <Badge
            className={cn(
              selectedUnit?.status === 'Available'
                ? 'bg-emerald-500'
                : selectedUnit?.status === 'Occupied'
                  ? 'bg-indigo-500'
                  : selectedUnit?.status === 'Maintenance'
                    ? 'bg-rose-500'
                    : selectedUnit?.status === 'Reserved'
                      ? 'bg-amber-500'
                      : 'bg-slate-500'
            )}
          >
            {selectedUnit?.status ? statusLabel(selectedUnit.status) : ''}
          </Badge>
        </div>

        <ScrollArea className="max-h-[60vh] pr-4">
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
                {selectedUnit?.inventory?.length ? (
                  selectedUnit.inventory.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-2 text-sm border-b border-slate-100">
                      <span className="text-slate-700">
                        {inv.name} (×{inv.quantity})
                      </span>
                      <Badge variant="outline" className="text-[10px] h-5">
                        {inv.condition}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 col-span-full">{t('views.units.inventoryEmpty')}</p>
                )}
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
                    <Badge variant="outline" className="text-[10px]">
                      {t('views.units.details.completed')}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2 text-amber-600">
                <Plus className="w-4 h-4" />
                {t('views.units.details.specialRequests')}
              </h4>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-900 italic">{t('views.units.details.remarksText')}</div>
            </div>
          </div>
        </ScrollArea>
      </Modal>

      <Modal
        isOpen={isAddUnitOpen}
        onClose={closeAddUnitModal}
        title={formMode === 'edit' ? t('views.units.editModal.title') : t('views.units.addModal.title')}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={closeAddUnitModal}>
              {t('views.units.addModal.cancel')}
            </Button>
            <Button
              type="button"
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => void handleSaveUnit()}
            >
              {formMode === 'edit' ? t('views.units.editModal.save') : t('views.units.addModal.save')}
            </Button>
          </div>
        }
      >
        {formMode === 'create' && (
          <p className="text-sm text-slate-500 mb-6">{t('views.units.addModal.description')}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="add-unit-number">{t('views.units.addModal.unitNumber')}</Label>
            <Input
              id="add-unit-number"
              value={addForm.unitNumber}
              onChange={(e) => setAddForm((f) => ({ ...f, unitNumber: e.target.value }))}
              placeholder="e.g. 1201"
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-floor">{t('views.units.addModal.floor')}</Label>
            <Input
              id="add-floor"
              value={addForm.floor}
              onChange={(e) => setAddForm((f) => ({ ...f, floor: e.target.value }))}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-tower">{t('views.units.addModal.tower')}</Label>
            <Input
              id="add-tower"
              value={addForm.tower}
              onChange={(e) => setAddForm((f) => ({ ...f, tower: e.target.value }))}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="add-building">{t('views.units.addModal.buildingName')}</Label>
            <Input
              id="add-building"
              value={addForm.buildingName}
              onChange={(e) => setAddForm((f) => ({ ...f, buildingName: e.target.value }))}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="add-common">{t('views.units.addModal.commonAddress')}</Label>
            <Input
              id="add-common"
              value={addForm.commonAddress}
              onChange={(e) => setAddForm((f) => ({ ...f, commonAddress: e.target.value }))}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="add-legal">{t('views.units.addModal.legalAddress')}</Label>
            <Input
              id="add-legal"
              value={addForm.legalAddress}
              onChange={(e) => setAddForm((f) => ({ ...f, legalAddress: e.target.value }))}
              className="rounded-xl border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.units.addModal.type')}</Label>
            <Select2
              options={addTypeOptions}
              value={addForm.type}
              onChange={(v) =>
                setAddForm((f) => ({ ...f, type: (v ?? '1BR') as UnitType }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.units.addModal.status')}</Label>
            <Select2
              options={addStatusOptions}
              value={addForm.status}
              onChange={(v) =>
                setAddForm((f) => ({ ...f, status: (v ?? 'Available') as UnitStatus }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t('views.units.addModal.area')}</Label>
            <Select2
              options={addAreaOptions}
              value={addForm.area}
              onChange={(v) =>
                setAddForm((f) => ({ ...f, area: (v ?? 'Makati') as Unit['area'] }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-rate">{t('views.units.addModal.monthlyRate')}</Label>
            <Input
              id="add-rate"
              type="text"
              inputMode="decimal"
              value={addForm.monthlyRate}
              onChange={(e) => setAddForm((f) => ({ ...f, monthlyRate: e.target.value }))}
              placeholder="35000"
              className="rounded-xl border-slate-200"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
