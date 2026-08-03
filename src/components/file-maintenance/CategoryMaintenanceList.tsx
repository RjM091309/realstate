import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, modalDismissButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/modal';
import {
  CORE_CATEGORY_IDS,
  type FileMaintenanceCategory,
} from '@/lib/fileMaintenanceCategories';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const PAGE_SIZES = [5, 10, 25, 50];

type CategoryMaintenanceListProps = {
  items: FileMaintenanceCategory[];
  onChange: (next: FileMaintenanceCategory[]) => void;
};

/** Services-Category style list + nested New/Edit modal for File Maintenance. */
export function CategoryMaintenanceList({ items, onChange }: CategoryMaintenanceListProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => row.name.toLowerCase().includes(q) || row.id.toLowerCase().includes(q));
  }, [items, search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const showingFrom = total === 0 ? 0 : start + 1;
  const showingTo = Math.min(start + pageSize, total);

  const openCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormOpen(true);
  };

  const openEdit = (row: FileMaintenanceCategory) => {
    setEditingId(row.id);
    setFormName(row.name);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setFormName('');
  };

  const handleSave = () => {
    const name = formName.trim();
    if (!name) {
      toast.error(t('views.fileMaintenance.categoryRequired'));
      return;
    }
    const duplicate = items.some(
      (row) => row.name.toLowerCase() === name.toLowerCase() && row.id !== editingId,
    );
    if (duplicate) {
      toast.error(t('views.fileMaintenance.categoryExists'));
      return;
    }
    if (editingId) {
      onChange(items.map((row) => (row.id === editingId ? { ...row, name } : row)));
      toast.success(t('views.fileMaintenance.categoryUpdated'));
    } else {
      const id = `cat-${Date.now()}`;
      onChange([...items, { id, name, status: 'Active' }]);
      toast.success(t('views.fileMaintenance.categoryCreated'));
    }
    closeForm();
  };

  const handleDelete = (row: FileMaintenanceCategory) => {
    if (CORE_CATEGORY_IDS.includes(row.id as (typeof CORE_CATEGORY_IDS)[number])) {
      toast.error(t('views.fileMaintenance.cannotDeleteCore'));
      return;
    }
    if (!window.confirm(t('views.fileMaintenance.deleteConfirm', { name: row.name }))) return;
    onChange(items.filter((x) => x.id !== row.id));
    toast.success(t('views.fileMaintenance.categoryDeleted'));
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span>{t('views.fileMaintenance.show')}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>{t('views.fileMaintenance.entries')}</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-white shadow-sm transition hover:bg-slate-800"
              title={t('views.fileMaintenance.addCategory')}
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="relative min-w-[10rem] sm:min-w-[14rem]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t('views.fileMaintenance.searchEllipsis')}
                className="h-9 rounded-lg border-slate-200 bg-white pl-8 text-xs shadow-none dark:border-slate-600 dark:bg-slate-950"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80">
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {t('views.fileMaintenance.columns.category')}
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {t('views.fileMaintenance.columns.status')}
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {t('views.fileMaintenance.columns.action')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-xs text-slate-400">
                      {t('views.fileMaintenance.noCategoryMatch')}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-b border-slate-100 last:border-b-0 dark:border-slate-800',
                        idx % 2 === 1 && 'bg-slate-50/80 dark:bg-slate-900/40',
                      )}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{row.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide',
                            row.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                          )}
                        >
                          {row.status === 'Active'
                            ? t('views.fileMaintenance.statusActive')
                            : t('views.fileMaintenance.statusInactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-sky-100 text-sky-700 transition hover:bg-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:hover:bg-sky-500/30"
                            title={t('views.fileMaintenance.editCategory')}
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-rose-100 text-rose-600 transition hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/30"
                            title={t('views.fileMaintenance.deleteCategory')}
                            onClick={() => handleDelete(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
          <p>
            {t('views.fileMaintenance.showingEntries', {
              from: showingFrom,
              to: showingTo,
              total,
            })}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 font-semibold disabled:opacity-40 dark:border-slate-600 dark:bg-slate-950"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t('views.fileMaintenance.previous')}
            </button>
            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-slate-700 px-2 font-bold text-white">
              {safePage}
            </span>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 font-semibold disabled:opacity-40 dark:border-slate-600 dark:bg-slate-950"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t('views.fileMaintenance.next')}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={
          editingId
            ? t('views.fileMaintenance.editCategoryTitle')
            : t('views.fileMaintenance.newCategoryTitle')
        }
        maxWidth="sm"
        compact
        shellClassName="gd-simple-modal-shell"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              className="h-9 min-w-[5.5rem] rounded-md bg-slate-700 px-4 text-sm font-semibold text-white shadow-none hover:bg-slate-800"
              onClick={handleSave}
            >
              {t('views.fileMaintenance.save')}
            </Button>
            <Button
              type="button"
              className="h-9 min-w-[5.5rem] rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-none hover:bg-slate-50"
              onClick={closeForm}
            >
              {t('views.fileMaintenance.close')}
            </Button>
          </div>
        }
      >
        <input
          id="fm-category-name"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder={t('views.fileMaintenance.categoryPlaceholder')}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            }
          }}
        />
      </Modal>
    </>
  );
}
