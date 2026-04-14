import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  SIDEBAR_FEATURE_KEYS,
  featureKeyToNavMenuKey,
  type SidebarFeatureKey,
} from '@/constants/access';

type RoleRow = { id: number; name: string };

type Crud = { create: boolean; update: boolean; delete: boolean };
type ModulesState = Record<string, Crud>;

function AccessToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-transparent transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        checked
          ? 'bg-indigo-600 shadow-sm shadow-indigo-900/10'
          : 'bg-slate-200 hover:bg-slate-300',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-1 ring-black/5 transition duration-200',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-1" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

function emptyModules(): ModulesState {
  const m: ModulesState = {};
  for (const k of SIDEBAR_FEATURE_KEYS) {
    m[k] = { create: false, update: false, delete: false };
  }
  return m;
}

export function UserAccessView() {
  const { t } = useTranslation();
  const { refreshSession } = useAuth();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [focusedModuleKey, setFocusedModuleKey] = useState<SidebarFeatureKey>(SIDEBAR_FEATURE_KEYS[0]!);
  const [roleModules, setRoleModules] = useState<ModulesState>(emptyModules());
  const [savedRoleModules, setSavedRoleModules] = useState<ModulesState>(emptyModules());
  const [roleSidebarFeatures, setRoleSidebarFeatures] = useState<Set<string>>(new Set());
  const [savedRoleSidebarFeatures, setSavedRoleSidebarFeatures] = useState<Set<string>>(new Set());

  const [savingRole, setSavingRole] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const rowRefs = useRef<Partial<Record<SidebarFeatureKey, HTMLTableRowElement | null>>>({});

  const roleCrudDirty = useMemo(() => {
    return JSON.stringify(roleModules) !== JSON.stringify(savedRoleModules);
  }, [roleModules, savedRoleModules]);

  const roleSidebarDirty = useMemo(() => {
    if (roleSidebarFeatures.size !== savedRoleSidebarFeatures.size) return true;
    for (const k of roleSidebarFeatures) {
      if (!savedRoleSidebarFeatures.has(k)) return true;
    }
    return false;
  }, [roleSidebarFeatures, savedRoleSidebarFeatures]);

  const roleSectionDirty = roleSidebarDirty || roleCrudDirty;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadError(null);
      setForbidden(false);
      setInitialLoading(true);
      try {
        const rl = await apiFetch<{ roles: RoleRow[] }>('/api/admin/roles');
        if (!alive) return;
        setRoles(rl.roles);
        if (rl.roles.length) setRoleId(rl.roles[0]!.id);
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('Administrator') || msg.toLowerCase().includes('forbidden')) setForbidden(true);
        else setLoadError(t('views.userAccess.loadError'));
      } finally {
        if (alive) setInitialLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  useEffect(() => {
    if (roleId === null) return;
    let cancelled = false;
    (async () => {
      try {
        const [crudData, sideData] = await Promise.all([
          apiFetch<{ modules: ModulesState }>(`/api/admin/roles/${roleId}/crud`),
          apiFetch<{ featureKeys: string[] }>(`/api/admin/roles/${roleId}/sidebar`),
        ]);
        if (cancelled) return;
        const merged = emptyModules();
        for (const k of SIDEBAR_FEATURE_KEYS) {
          merged[k] = crudData.modules[k] ?? { create: false, update: false, delete: false };
        }
        setRoleModules(merged);
        setSavedRoleModules(JSON.parse(JSON.stringify(merged)) as ModulesState);
        const rs = new Set(sideData.featureKeys);
        setRoleSidebarFeatures(rs);
        setSavedRoleSidebarFeatures(new Set(rs));
      } catch {
        if (!cancelled) setLoadError(t('views.userAccess.loadError'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roleId, t]);

  async function saveRole() {
    if (roleId === null) return;
    setSavingRole(true);
    setToast(null);
    try {
      if (roleSidebarDirty) {
        await apiFetch(`/api/admin/roles/${roleId}/sidebar`, {
          method: 'PUT',
          body: JSON.stringify({ featureKeys: [...roleSidebarFeatures] }),
        });
        setSavedRoleSidebarFeatures(new Set(roleSidebarFeatures));
      }
      if (roleCrudDirty) {
        await apiFetch(`/api/admin/roles/${roleId}/crud`, {
          method: 'PUT',
          body: JSON.stringify({ modules: roleModules }),
        });
        setSavedRoleModules(JSON.parse(JSON.stringify(roleModules)) as ModulesState);
      }
      setToast(t('views.userAccess.saved'));
      void refreshSession();
    } catch {
      setLoadError(t('views.userAccess.loadError'));
    } finally {
      setSavingRole(false);
    }
  }

  function setCrud(key: SidebarFeatureKey, field: keyof Crud, value: boolean) {
    setRoleModules((prev) => ({
      ...prev,
      [key]: { ...prev[key]!, [field]: value },
    }));
  }

  function toggleRoleSidebar(key: SidebarFeatureKey, on: boolean) {
    setRoleSidebarFeatures((prev) => {
      const n = new Set(prev);
      if (on) n.add(key);
      else n.delete(key);
      return n;
    });
  }

  useEffect(() => {
    setFocusedModuleKey(SIDEBAR_FEATURE_KEYS[0]!);
  }, [roleId]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      rowRefs.current[focusedModuleKey]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [focusedModuleKey, roleId]);

  if (forbidden) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50 to-white px-8 py-10 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Shield className="h-6 w-6" />
        </div>
        <p className="font-medium text-amber-950">{t('views.userAccess.forbidden')}</p>
      </div>
    );
  }

  return (
    <div className="w-full animate-in fade-in duration-300">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Shield className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {t('views.userAccess.title')}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">{t('views.userAccess.subtitle')}</p>
              {!initialLoading ? (
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {t('views.userAccess.threeColumnRolesTitle')}:{' '}
                  <span className="tabular-nums text-slate-700">{roles.length}</span>
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {roleSectionDirty ? (
              <p className="text-xs font-medium text-amber-800">{t('views.userAccess.dirtyHint')}</p>
            ) : null}
            <Button
              type="button"
              className="shrink-0 rounded-lg bg-indigo-600 px-5 hover:bg-indigo-700"
              disabled={!roleSectionDirty || savingRole || roleId === null || initialLoading}
              onClick={() => void saveRole()}
            >
              {savingRole ? t('views.userAccess.saving') : t('views.userAccess.save')}
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {loadError ? (
            <div
              className="rounded-xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-800"
              role="alert"
            >
              {loadError}
            </div>
          ) : null}
          {toast ? (
            <div
              className="rounded-xl border border-emerald-100 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-900"
              role="status"
            >
              {toast}
            </div>
          ) : null}

          <section
            className="grid min-h-0 grid-cols-1 gap-4 min-[1100px]:grid-cols-[minmax(200px,260px)_minmax(200px,280px)_minmax(0,1fr)] min-[1100px]:items-stretch min-[1100px]:gap-5"
            style={{ minHeight: 'min(640px, calc(100vh - 13rem))' }}
            aria-label={t('views.userAccess.title')}
          >
            <Card className="flex min-h-[280px] min-w-0 flex-col overflow-hidden border-slate-200/90 shadow-sm min-[1100px]:min-h-0">
              <CardHeader className="shrink-0 space-y-1 border-b border-slate-100 px-4 py-3">
                <CardTitle className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {t('views.userAccess.threeColumnRolesTitle')}
                </CardTitle>
                <CardDescription className="text-xs leading-snug text-slate-500">
                  {t('views.userAccess.threeColumnRolesDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1 custom-scrollbar">
                {initialLoading ? (
                  <ListSkeleton rows={5} />
                ) : roles.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-slate-500">—</p>
                ) : (
                  <ul className="space-y-1">
                    {roles.map((r, idx) => {
                      const active = roleId === r.id;
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => setRoleId(r.id)}
                            className={cn(
                              'relative flex w-full items-center justify-between gap-2 rounded-lg py-2.5 pl-3 pr-2 text-left text-sm transition-colors',
                              active
                                ? 'bg-violet-50 text-violet-950 shadow-sm ring-1 ring-violet-200/80'
                                : 'text-slate-700 hover:bg-slate-50',
                            )}
                          >
                            {active ? (
                              <span
                                className="absolute left-0 top-1/2 h-[60%] w-1 -translate-y-1/2 rounded-full bg-violet-600"
                                aria-hidden
                              />
                            ) : null}
                            <span className={cn('min-w-0 pl-1', active && 'pl-0.5')}>
                              <span className="font-medium">
                                {idx + 1}. {r.name}
                              </span>
                            </span>
                            <span
                              className={cn(
                                'inline-flex min-w-[1.75rem] shrink-0 justify-end tabular-nums',
                                active
                                  ? 'rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800'
                                  : 'text-transparent',
                              )}
                              aria-hidden={!active}
                            >
                              {roleSidebarFeatures.size}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="flex min-h-[280px] min-w-0 flex-col overflow-hidden border-slate-200/90 shadow-sm min-[1100px]:min-h-0">
              <CardHeader className="shrink-0 space-y-1 border-b border-slate-100 px-4 py-3">
                <CardTitle className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {t('views.userAccess.threeColumnModulesTitle')}
                </CardTitle>
                <CardDescription className="text-xs leading-snug text-slate-500">
                  {t('views.userAccess.threeColumnModulesDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1 custom-scrollbar">
                {initialLoading ? (
                  <ListSkeleton rows={6} />
                ) : (
                  <ul className="space-y-1.5">
                    {SIDEBAR_FEATURE_KEYS.map((key, idx) => {
                      const navKey = featureKeyToNavMenuKey(key);
                      const label = t(`nav.menu.${navKey}`);
                      const row = roleModules[key]!;
                      const crudCount = (row.create ? 1 : 0) + (row.update ? 1 : 0) + (row.delete ? 1 : 0);
                      const active = focusedModuleKey === key;
                      const inSidebar = roleSidebarFeatures.has(key);
                      return (
                        <li key={key}>
                          <div
                            className={cn(
                              'relative flex items-stretch gap-1 rounded-lg py-1.5 pl-3 pr-1.5 transition-colors',
                              active
                                ? 'bg-amber-50 text-amber-950 shadow-sm ring-1 ring-amber-200/90'
                                : 'text-slate-700 hover:bg-slate-50',
                            )}
                          >
                            {active ? (
                              <span
                                className="absolute left-0 top-1/2 h-[55%] w-1 -translate-y-1/2 rounded-full bg-amber-500"
                                aria-hidden
                              />
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setFocusedModuleKey(key)}
                              className={cn(
                                'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md py-1.5 text-left text-sm',
                                active ? 'pl-0.5' : 'pl-1',
                              )}
                            >
                              <span className="min-w-0 truncate font-medium">
                                {idx + 1}. {label}
                              </span>
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-700">
                                {crudCount}
                              </span>
                            </button>
                            <div
                              className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-slate-200/80 pl-1.5"
                              title={t('views.userAccess.modulesSidebarToggleTitle')}
                            >
                              <span className="max-w-[4.5rem] text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-slate-400">
                                {t('views.userAccess.modulesSidebarToggleLabel')}
                              </span>
                              <AccessToggle
                                checked={inSidebar}
                                onCheckedChange={(v) => toggleRoleSidebar(key, v)}
                              />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="flex min-h-[320px] min-w-0 flex-col overflow-hidden border-slate-200/90 shadow-sm min-[1100px]:min-h-0">
              <CardHeader className="shrink-0 space-y-1 border-b border-slate-100 px-4 py-3">
                <CardTitle className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {t('views.userAccess.permHeading')}
                </CardTitle>
                <CardDescription className="text-xs leading-snug text-slate-500">
                  {t('views.userAccess.permSub')}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 pt-1 sm:px-4">
                <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white custom-scrollbar">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50">
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        <th className="whitespace-nowrap px-3 py-3 sm:px-4">{t('views.userAccess.colModule')}</th>
                        <th className="whitespace-nowrap px-2 py-3 text-center sm:px-3">
                          {t('views.userAccess.colAdd')}
                        </th>
                        <th className="whitespace-nowrap px-2 py-3 text-center sm:px-3">
                          {t('views.userAccess.colEdit')}
                        </th>
                        <th className="whitespace-nowrap px-2 py-3 text-center sm:px-3">
                          {t('views.userAccess.colDelete')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {SIDEBAR_FEATURE_KEYS.map((key) => {
                        const navKey = featureKeyToNavMenuKey(key);
                        const label = t(`nav.menu.${navKey}`);
                        const desc = t(`views.userAccess.moduleDesc.${key}`);
                        const row = roleModules[key]!;
                        const highlight = focusedModuleKey === key;
                        return (
                          <tr
                            key={key}
                            ref={(el) => {
                              rowRefs.current[key] = el;
                            }}
                            className={cn(
                              'transition-colors',
                              highlight ? 'bg-amber-50/90 ring-1 ring-inset ring-amber-200/80' : 'hover:bg-slate-50/80',
                            )}
                          >
                            <td className="px-3 py-3 sm:px-4">
                              <p className="font-medium text-slate-900">{label}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
                            </td>
                            <td className="px-2 py-3 text-center align-middle sm:px-3">
                              <div className="flex justify-center">
                                <AccessToggle
                                  checked={row.create}
                                  onCheckedChange={(v) => setCrud(key, 'create', v)}
                                />
                              </div>
                            </td>
                            <td className="px-2 py-3 text-center align-middle sm:px-3">
                              <div className="flex justify-center">
                                <AccessToggle
                                  checked={row.update}
                                  onCheckedChange={(v) => setCrud(key, 'update', v)}
                                />
                              </div>
                            </td>
                            <td className="px-2 py-3 text-center align-middle sm:px-3">
                              <div className="flex justify-center">
                                <AccessToggle
                                  checked={row.delete}
                                  onCheckedChange={(v) => setCrud(key, 'delete', v)}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="shrink-0 text-xs leading-relaxed text-slate-500">{t('views.userAccess.permFooter')}</p>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
