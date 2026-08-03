import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Pencil, Plus, Search, Shield, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button, modalDismissButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/modal';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { SkeletonTable } from '@/components/skeleton';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const ADMIN_ROLE_ID = 1;

type AssignedUser = {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl: string | null;
};

type RoleCard = {
  id: number;
  name: string;
  active: boolean;
  userCount: number;
  assignedUsers: AssignedUser[];
};

const inputClass =
  'h-11 rounded-xl border-slate-200 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

function initials(u: AssignedUser): string {
  const a = (u.firstName || '').trim().charAt(0);
  const b = (u.lastName || '').trim().charAt(0);
  if (a && b) return (a + b).toUpperCase();
  const un = (u.username || '').trim();
  return un.slice(0, 2).toUpperCase() || '?';
}

export function UserRoleManagementView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const isAdmin = session?.role.id === ADMIN_ROLE_ID;

  const [roles, setRoles] = useState<RoleCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') return 'grid';
    const raw = window.localStorage.getItem('userRole.viewMode');
    return raw === 'list' ? 'list' : 'grid';
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleCard | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleActive, setRoleActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RoleCard | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadRoles = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ roles: RoleCard[] }>('/api/admin/roles?includeInactive=1');
      const list = Array.isArray(res.roles) ? res.roles : [];
      setRoles(
        list.map((r) => ({
          id: Number(r.id),
          name: String(r.name ?? ''),
          active: Boolean(r.active),
          userCount: Number(r.userCount ?? 0),
          assignedUsers: Array.isArray(r.assignedUsers) ? r.assignedUsers : [],
        })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.userRole.loadError'));
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, t]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => r.name.toLowerCase().includes(q));
  }, [roles, search]);

  useEffect(() => {
    try {
      window.localStorage.setItem('userRole.viewMode', viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  const roleColumns: ColumnDef<RoleCard>[] = useMemo(
    () => [
      {
        header: t('views.userRole.title'),
        render: (r) => (
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white dark:bg-slate-700">
              <Shield className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{r.name}</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('views.userRole.accessLevelProfile')}
              </div>
            </div>
          </div>
        ),
      },
      {
        header: t('views.userRole.activeLabel'),
        render: (r) => (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
              r.active
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', r.active ? 'bg-emerald-500' : 'bg-slate-400')} />
            {r.active ? t('views.userRole.statusActive') : t('views.userRole.statusInactive')}
          </span>
        ),
        className: 'w-[10rem]',
      },
      {
        header: 'Action',
        className: 'text-right',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (r) => {
          const canRemove = r.id !== ADMIN_ROLE_ID;
          return (
            <div className="inline-flex items-center justify-end gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-lg text-slate-500 hover:text-brand-blue hover:bg-brand-blue/10 dark:text-slate-400 dark:hover:bg-brand-blue/20"
                aria-label={t('views.userRole.edit')}
                onClick={() => openEdit(r)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {canRemove ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  aria-label={t('views.userRole.remove')}
                  onClick={() => {
                    setRemoveTarget(r);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t, openEdit],
  );

  const mapErr = (msg: string) => {
    const m = msg.toLowerCase();
    if (m.includes('already exists')) return t('views.userRole.duplicateName');
    if (m.includes('reassign or deactivate users')) return t('views.userRole.hasUsers');
    if (m.includes('administrator role cannot be removed')) return t('views.userRole.cannotRemoveAdmin');
    if (m.includes('administrator role cannot be deactivated')) return t('views.userRole.cannotDeactivateAdmin');
    return msg;
  };

  const opError = (e: unknown) =>
    toast.error(mapErr(e instanceof Error ? e.message : t('views.userInfo.saveError')));

  const openAdd = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleActive(true);
    setFormOpen(true);
  };

  function openEdit(r: RoleCard) {
    setEditingRole(r);
    setRoleName(r.name);
    setRoleActive(r.active);
    setFormOpen(true);
  }

  const dismissForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingRole(null);
  };

  const handleSaveForm = async () => {
    const name = roleName.trim();
    if (!name) {
      toast.error(t('views.userInfo.missingFields'));
      return;
    }
    setSaving(true);
    try {
      if (editingRole) {
        const body: { name: string; active?: boolean } = { name };
        if (editingRole.id !== ADMIN_ROLE_ID) body.active = roleActive;
        await apiFetch(`/api/admin/roles/${editingRole.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success(t('views.userRole.savedEdit'));
      } else {
        await apiFetch('/api/admin/roles', { method: 'POST', body: JSON.stringify({ name }) });
        toast.success(t('views.userRole.savedAdd'));
      }
      setFormOpen(false);
      setEditingRole(null);
      await loadRoles();
    } catch (e) {
      opError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await apiFetch(`/api/admin/roles/${removeTarget.id}`, { method: 'DELETE' });
      toast.success(t('views.userRole.removed'));
      setRemoveTarget(null);
      await loadRoles();
    } catch (e) {
      opError(e);
    } finally {
      setRemoving(false);
    }
  };

  const pageTitle = (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('views.userRole.title')}</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('views.userRole.subtitle')}</p>
    </div>
  );

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        {pageTitle}
        <Card className="border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardContent className="py-10 px-6 text-center text-sm text-slate-600 dark:text-slate-400">
            {t('views.userRole.adminOnly')}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {pageTitle}
        <Button
          type="button"
          onClick={openAdd}
          className="rounded-xl bg-brand-blue px-5 text-white shadow-sm hover:bg-[#3d7ab8]"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('views.userRole.addRole')}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('views.userRole.searchPlaceholder')}
            className={cn('h-10 w-full rounded-full border-slate-200 pl-10 dark:border-slate-700', inputClass)}
          />
        </div>

        <div className="inline-flex w-full items-center justify-end gap-2 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-10 rounded-full border-slate-200 px-4 text-slate-700 dark:border-slate-700 dark:text-slate-200',
              viewMode === 'grid'
                ? 'bg-slate-100 dark:bg-slate-800'
                : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800',
            )}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="mr-2 h-4 w-4" />
            Grid
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-10 rounded-full border-slate-200 px-4 text-slate-700 dark:border-slate-700 dark:text-slate-200',
              viewMode === 'list'
                ? 'bg-slate-100 dark:bg-slate-800'
                : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800',
            )}
            onClick={() => setViewMode('list')}
          >
            <List className="mr-2 h-4 w-4" />
            List
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SkeletonTable rows={8} columns={3} showToolbar={false} />
        </div>
      ) : (
        <>
          {viewMode === 'list' ? (
            <DataTable
              data={filtered}
              columns={roleColumns}
              keyExtractor={(r) => r.id}
                          />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r) => {
                const canRemove = r.id !== ADMIN_ROLE_ID;

                return (
                  <div
                    key={r.id}
                    className={cn(
                      'flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition dark:bg-slate-900',
                      r.active
                        ? 'border-slate-200/90 dark:border-slate-800'
                        : 'border-dashed border-slate-300 opacity-90 dark:border-slate-600',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white dark:bg-slate-700">
                          <Shield className="h-6 w-6" strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold leading-tight text-slate-900 dark:text-slate-50">
                            {r.name}
                          </h2>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-lg text-slate-500 hover:text-brand-blue hover:bg-brand-blue/10 dark:text-slate-400 dark:hover:bg-brand-blue/20"
                          aria-label={t('views.userRole.edit')}
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canRemove ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                            aria-label={t('views.userRole.remove')}
                            onClick={() => {
                              setRemoveTarget(r);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                          r.active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', r.active ? 'bg-emerald-500' : 'bg-slate-400')} />
                        {r.active ? t('views.userRole.statusActive') : t('views.userRole.statusInactive')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={formOpen}
        onClose={dismissForm}
        title={editingRole ? t('views.userRole.modalEditTitle') : t('views.userRole.modalAddTitle')}
        maxWidth="md"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <Button type="button" className={modalDismissButtonClass} onClick={dismissForm} disabled={saving}>
              {t('views.userRole.cancel')}
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveForm()}
              className="rounded-xl bg-brand-blue px-6 text-white shadow-sm hover:bg-[#3d7ab8]"
            >
              {saving ? '…' : t('views.userRole.saveRole')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {t('views.userRole.roleName')}
            </Label>
            <Input
              className={cn(inputClass, 'ring-brand-blue/30 focus-visible:ring-2')}
              placeholder={t('views.userRole.roleNamePlaceholder')}
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              autoComplete="off"
            />
          </div>
          {!editingRole ? <p className="text-sm text-slate-500 dark:text-slate-400">{t('views.userRole.helperNew')}</p> : null}
          {editingRole && editingRole.id !== ADMIN_ROLE_ID ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                checked={roleActive}
                onChange={(e) => setRoleActive(e.target.checked)}
              />
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('views.userRole.activeLabel')}</span>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('views.userRole.activeHint')}</p>
              </div>
            </label>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(removeTarget)}
        onClose={() => {
          if (!removing) setRemoveTarget(null);
        }}
        title={t('views.userRole.confirmRemoveTitle')}
        maxWidth="md"
        footer={
          <div className="flex w-full items-center justify-end gap-3">
            <Button type="button" className={modalDismissButtonClass} onClick={() => setRemoveTarget(null)} disabled={removing}>
              {t('views.userRole.cancel')}
            </Button>
            <Button
              type="button"
              disabled={removing}
              onClick={() => void handleConfirmRemove()}
              className="rounded-xl bg-rose-600 px-5 text-white hover:bg-rose-700"
            >
              {removing ? '…' : t('views.userRole.confirmRemoveAction')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('views.userRole.confirmRemoveBody')}</p>
      </Modal>
    </div>
  );
}
