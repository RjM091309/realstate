import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ImagePlus,
  Plus,
  Search,
  Pencil,
  Shield,
  Trash2,
  UserRoundCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button, modalDismissButtonClass, modalPrimaryButtonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/modal';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ProfileAvatarHoverPreview } from '@/components/ProfileAvatarHoverPreview';
import { cn } from '@/lib/utils';

type StaffUser = {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  roleId: number;
  roleName: string;
  branchId: number | null;
  branchName: string | null;
  active: boolean;
  avatarUrl?: string | null;
};

type RoleOption = { id: number; name: string };

const inputClass =
  'h-11 rounded-xl border-slate-200 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

/** Must match server `MIN_PASSWORD_LENGTH` in authController.js */
const PASSWORD_MIN_LENGTH = 4;
const ADMIN_ROLE_ID = 1;

type UserStatTone = 'neutral' | 'success' | 'danger' | 'info';

function UserStatCard({
  label,
  value,
  subtitle,
  tone,
  icon,
  index = 0,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  tone: UserStatTone;
  icon: React.ReactNode;
  index?: number;
}) {
  const fromLeft = index % 2 === 0;
  const iconColor =
    tone === 'success'
      ? 'bg-brand-green'
      : tone === 'danger'
        ? 'bg-rose-500'
        : tone === 'info'
          ? 'bg-brand-blue'
          : 'bg-[#334155]';
  const valueColor =
    tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'danger'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-800 dark:text-slate-100';
  const footerClass =
    tone === 'success'
      ? 'text-brand-green'
      : tone === 'danger'
        ? 'text-rose-500'
        : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500';

  return (
    <motion.div
      initial="hidden"
      animate="show"
      whileHover="hover"
      variants={{
        hidden: {
          opacity: 0,
          x: fromLeft ? -36 : 36,
          y: 18,
          scale: 0.88,
        },
        show: {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          transition: {
            type: 'spring',
            stiffness: 260,
            damping: 16,
            mass: 0.9,
            delay: 0.06 + index * 0.09,
          },
        },
        hover: {
          scale: 1.035,
          y: -4,
          borderColor: 'rgba(75,137,205,0.45)',
          boxShadow: '0 18px 36px -16px rgba(75,137,205,0.4), 0 8px 16px -10px rgba(15,23,42,0.2)',
          transition: { type: 'spring', stiffness: 420, damping: 18 },
        },
      }}
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-100/90 bg-white/95 p-4 text-left',
        'shadow-[0_8px_24px_-14px_rgba(15,23,42,0.22)]',
        'dark:border-slate-800 dark:bg-slate-900/90',
        'dark:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.55)]',
      )}
    >
      <div className="relative mb-4 flex items-start justify-between">
        <motion.div
          initial={{ scale: 0, rotate: -28 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: 'spring',
            stiffness: 460,
            damping: 14,
            delay: 0.18 + index * 0.08,
          }}
          variants={{
            show: { scale: 1, y: 0 },
            hover: { scale: 1.12, y: -3, transition: { type: 'spring', stiffness: 400, damping: 16 } },
          }}
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg',
            'ring-1 ring-white/25',
            iconColor,
          )}
        >
          <motion.span
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2.4 + index * 0.15, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex"
          >
            {icon}
          </motion.span>
        </motion.div>
        <div className="text-right">
          <motion.p
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + index * 0.08, duration: 0.35 }}
            className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            {label}
          </motion.p>
          <div className="overflow-hidden">
            <motion.h3
              key={String(value)}
              initial={{ y: '110%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              transition={{
                type: 'spring',
                stiffness: 280,
                damping: 18,
                delay: 0.22 + index * 0.08,
              }}
              className={cn('text-3xl font-bold tabular-nums', valueColor)}
            >
              {value}
            </motion.h3>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scaleX: 0.6 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.32 + index * 0.08, duration: 0.4 }}
        style={{ transformOrigin: 'left center' }}
        className={cn(
          'relative mt-auto flex items-center gap-1 border-t border-slate-50 pt-3 text-xs font-medium transition-colors dark:border-slate-800',
          footerClass,
        )}
      >
        {tone === 'success' && (
          <motion.span
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex"
          >
            <UserRoundCheck className="h-3 w-3" />
          </motion.span>
        )}
        {tone === 'danger' && <XCircle className="h-3 w-3" />}
        {subtitle}
      </motion.div>
    </motion.div>
  );
}

function staffInitials(firstName: string, lastName: string, username: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  if (a && b) return (a + b).toUpperCase();
  const u = username.trim();
  return u.slice(0, 2).toUpperCase() || '?';
}

function StatusSwitch({
  checked,
  disabled,
  onCheckedChange,
  id,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 rounded-full border border-transparent transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2',
        disabled && 'cursor-not-allowed opacity-60',
        !disabled && 'cursor-pointer',
        checked
          ? 'bg-brand-blue shadow-sm shadow-brand-blue/10'
          : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-1 ring-black/5 transition duration-200 dark:bg-slate-100',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function UserManagementView() {
  const { t } = useTranslation();
  const { session, refreshSession } = useAuth();
  const isAdmin = session?.role.id === ADMIN_ROLE_ID;
  const sessionUserId = session?.user.id;
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const toastSaveErr = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : t('views.userInfo.saveError'));

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);

  const [roleId, setRoleId] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [avatarDraftFile, setAvatarDraftFile] = useState<File | null>(null);
  const [avatarDraftObjectUrl, setAvatarDraftObjectUrl] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);

  const clearAvatarDraftState = useCallback(() => {
    setAvatarDraftObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAvatarDraftFile(null);
    setAvatarRemoved(false);
  }, []);

  const resetForm = useCallback(() => {
    clearAvatarDraftState();
    setEditing(null);
    setRoleId(roles[0]?.id ?? 1);
    setFirstName('');
    setLastName('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setFormActive(true);
  }, [roles, clearAvatarDraftState]);

  const openAdd = useCallback(() => {
    resetForm();
    setModalOpen(true);
  }, [resetForm]);

  const openEdit = useCallback(
    (u: StaffUser) => {
      clearAvatarDraftState();
      setEditing(u);
      setRoleId(u.roleId);
      setFirstName(u.firstName);
      setLastName(u.lastName);
      setUsername(u.username);
      setPassword('');
      setConfirmPassword('');
      setFormActive(u.active);
      setModalOpen(true);
    },
    [clearAvatarDraftState],
  );

  const loadLists = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        apiFetch<{ users: StaffUser[] }>('/api/auth/staff/users'),
        apiFetch<{ roles: RoleOption[] }>('/api/auth/roles'),
      ]);
      setUsers(Array.isArray(usersRes.users) ? usersRes.users : []);
      setRoles(Array.isArray(rolesRes.roles) ? rolesRes.roles : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('views.userInfo.loadError'));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, t]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const blob = [u.firstName, u.lastName, u.username, u.roleName]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [users, search]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.active).length;
    const inactive = total - active;
    const roleCount = new Set(users.map((u) => u.roleId)).size;
    return { total, active, inactive, roleCount };
  }, [users]);

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSave = async () => {
    const isEdit = editing != null;
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      toast.error(t('views.userInfo.missingFields'));
      return;
    }
    if (!isEdit) {
      if (!password || password.length < PASSWORD_MIN_LENGTH) {
        toast.error(t('views.userInfo.passwordMin'));
        return;
      }
      if (password !== confirmPassword) {
        toast.error(t('views.userInfo.passwordMismatch'));
        return;
      }
    } else if (password) {
      if (password.length < PASSWORD_MIN_LENGTH) {
        toast.error(t('views.userInfo.passwordMin'));
        return;
      }
      if (password !== confirmPassword) {
        toast.error(t('views.userInfo.passwordMismatch'));
        return;
      }
    }

    if (isEdit && editing.id === sessionUserId && !formActive) {
      toast.error(t('views.userInfo.cannotDeactivateSelf'));
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const body: Record<string, unknown> = {
          firstName,
          lastName,
          username,
          roleId,
          active: formActive,
        };
        if (password) body.password = password;
        await apiFetch(`/api/auth/staff/users/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success(t('views.userInfo.savedEdit'));
        const targetId = editing.id;
        if (avatarDraftFile) {
          const fd = new FormData();
          fd.append('file', avatarDraftFile);
          await apiFetch(`/api/auth/staff/users/${targetId}/photo`, { method: 'POST', body: fd });
        } else if (avatarRemoved && editing.avatarUrl) {
          await apiFetch(`/api/auth/staff/users/${targetId}/photo`, { method: 'DELETE' });
        }
        if (targetId === sessionUserId) await refreshSession();
      } else {
        const res = await apiFetch<{ user: StaffUser }>('/api/auth/staff/users', {
          method: 'POST',
          body: JSON.stringify({
            firstName,
            lastName,
            username,
            password,
            roleId,
          }),
        });
        toast.success(t('views.userInfo.savedAdd'));
        const newId = res.user?.id;
        if (newId && avatarDraftFile) {
          const fd = new FormData();
          fd.append('file', avatarDraftFile);
          await apiFetch(`/api/auth/staff/users/${newId}/photo`, { method: 'POST', body: fd });
        }
        if (newId === sessionUserId) await refreshSession();
      }
      closeModal();
      await loadLists();
    } catch (e) {
      toastSaveErr(e);
    } finally {
      setSaving(false);
    }
  };

  const onAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error(t('views.userInfo.avatarInvalidType'));
      return;
    }
    setAvatarDraftObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setAvatarDraftFile(f);
    setAvatarRemoved(false);
  };

  const handleSetActive = async (u: StaffUser, nextActive: boolean) => {
    if (!nextActive && u.id === sessionUserId) return;
    if (nextActive) {
      if (!window.confirm(t('views.userInfo.confirmActivate'))) return;
    } else if (!window.confirm(t('views.userInfo.confirmDeactivate'))) {
      return;
    }
    setStatusBusyId(u.id);
    try {
      await apiFetch(`/api/auth/staff/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: nextActive }),
      });
      toast.success(nextActive ? t('views.userInfo.activated') : t('views.userInfo.deactivated'));
      await loadLists();
    } catch (e) {
      toastSaveErr(e);
    } finally {
      setStatusBusyId(null);
    }
  };

  const pageTitle = (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('views.userInfo.title')}</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('views.userInfo.subtitle')}</p>
    </div>
  );

  const columns: ColumnDef<StaffUser>[] = [
    {
      header: t('views.userInfo.columns.fullName'),
      render: (u) => (
        <span className="flex items-center gap-3">
          <ProfileAvatarHoverPreview
            detachPreview
            avatarUrl={u.avatarUrl}
            initials={staffInitials(u.firstName, u.lastName, u.username)}
            avatarClassName="h-9 w-9 border border-slate-200 dark:border-slate-600"
            fallbackClassName="bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            previewClassName="h-36 w-36 min-h-36 min-w-36 sm:h-40 sm:w-40 sm:min-h-40 sm:min-w-40"
          />
          <span className="font-medium">
            {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.username}
          </span>
        </span>
      ),
    },
    { header: t('views.userInfo.columns.username'), accessorKey: 'username' },
    { header: t('views.userInfo.columns.role'), accessorKey: 'roleName' },
    {
      header: t('views.userInfo.columns.status'),
      render: (u) => (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
            u.active
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
              : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
          )}
        >
          {u.active ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2.25} aria-hidden />
          ) : (
            <XCircle className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2.25} aria-hidden />
          )}
          {u.active ? t('views.userInfo.statusActive') : t('views.userInfo.statusInactive')}
        </span>
      ),
    },
    {
      header: t('views.userInfo.columns.action'),
      render: (u) => {
        const busy = statusBusyId === u.id;
        const isSelf = u.id === sessionUserId;
        return (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg text-slate-500 hover:text-brand-blue hover:bg-brand-blue/10 dark:text-slate-400 dark:hover:bg-brand-blue/20"
              title={t('views.userInfo.edit')}
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                openEdit(u);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {u.active ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                disabled={busy || isSelf}
                title={isSelf ? t('views.userInfo.cannotDeactivateSelf') : t('views.userInfo.delete')}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleSetActive(u, false);
                }}
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                disabled={busy}
                title={t('views.userInfo.activateUser')}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleSetActive(u, true);
                }}
              >
                <UserRoundCheck className="h-4 w-4" strokeWidth={2} />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        {pageTitle}
        <Card className="border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardContent className="py-10 px-6 text-center text-sm text-slate-600 dark:text-slate-400">
            {t('views.userInfo.adminOnly')}
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
          {t('views.userInfo.addUser')}
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('views.userInfo.searchPlaceholder')}
          className={cn('h-10 rounded-full border-slate-200 pl-10 dark:border-slate-700', inputClass)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UserStatCard
          index={0}
          label={t('views.userInfo.stats.totalUsers')}
          value={loading ? '—' : stats.total}
          subtitle="All staff accounts"
          tone="neutral"
          icon={<Users className="h-6 w-6" />}
        />
        <UserStatCard
          index={1}
          label={t('views.userInfo.stats.activeUsers')}
          value={loading ? '—' : stats.active}
          subtitle="Currently active"
          tone="success"
          icon={<UserRoundCheck className="h-6 w-6" />}
        />
        <UserStatCard
          index={2}
          label={t('views.userInfo.stats.inactiveUsers')}
          value={loading ? '—' : stats.inactive}
          subtitle="Disabled accounts"
          tone="danger"
          icon={<XCircle className="h-6 w-6" />}
        />
        <UserStatCard
          index={3}
          label={t('views.userInfo.stats.userRoles')}
          value={loading ? '—' : stats.roleCount}
          subtitle="Assigned roles"
          tone="info"
          icon={<Shield className="h-6 w-6" />}
        />
      </div>

      <Card className="border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-0">
          <DataTable
            embedded
            data={filtered}
            columns={columns}
            keyExtractor={(u) => u.id}
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? t('views.userInfo.modalEditTitle') : t('views.userInfo.modalAddTitle')}
        maxWidth="lg"
        footer={
          <div className="flex w-full items-center justify-end gap-3">
            <Button type="button" className={modalDismissButtonClass} onClick={closeModal} disabled={saving}>
              {t('views.userInfo.cancel')}
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className={modalPrimaryButtonClass}
            >
              {saving ? '…' : t('views.userInfo.saveUser')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <input
            ref={avatarFileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onAvatarFileChange}
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              className={cn(
                'flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed',
                avatarDraftObjectUrl || (!avatarRemoved && editing?.avatarUrl)
                  ? 'border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50'
                  : 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/80',
              )}
            >
              {avatarDraftObjectUrl || (!avatarRemoved && editing?.avatarUrl) ? (
                <img
                  src={avatarDraftObjectUrl ?? editing?.avatarUrl ?? ''}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-slate-400 dark:text-slate-500">
                  {staffInitials(firstName, lastName, username)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {t('views.userInfo.avatarLabel')}
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t('views.userInfo.avatarHint')}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={saving}
                  onClick={() => avatarFileInputRef.current?.click()}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {t('views.userInfo.avatarUpload')}
                </Button>
                {(avatarDraftFile || (editing?.avatarUrl && !avatarRemoved)) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                    disabled={saving}
                    onClick={() => {
                      setAvatarDraftObjectUrl((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return null;
                      });
                      setAvatarDraftFile(null);
                      setAvatarRemoved(true);
                    }}
                  >
                    {t('views.userInfo.avatarRemove')}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {t('views.userInfo.labels.userRole')}
            </Label>
            <select
              className={cn('w-full border px-3 text-sm dark:border-slate-600 md:max-w-md', inputClass)}
              value={roleId}
              onChange={(e) => setRoleId(Number(e.target.value))}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {t('views.userInfo.labels.firstName')}
              </Label>
              <Input
                className={inputClass}
                placeholder={t('views.userInfo.placeholders.firstName')}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {t('views.userInfo.labels.lastName')}
              </Label>
              <Input
                className={inputClass}
                placeholder={t('views.userInfo.placeholders.lastName')}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {t('views.userInfo.labels.username')}
            </Label>
            <Input
              className={inputClass}
              placeholder={t('views.userInfo.placeholders.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
          </div>
          {editing ? (
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <Label
                  htmlFor="user-account-access"
                  className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400"
                >
                  {t('views.userInfo.accountAccessLabel')}
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {editing.id === sessionUserId
                    ? t('views.userInfo.accountAccessLockedHint')
                    : t('views.userInfo.accountAccessHint')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    formActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400',
                  )}
                >
                  {formActive ? t('views.userInfo.statusActive') : t('views.userInfo.statusInactive')}
                </span>
                <StatusSwitch
                  id="user-account-access"
                  checked={formActive}
                  disabled={editing.id === sessionUserId}
                  onCheckedChange={setFormActive}
                />
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {t('views.userInfo.labels.password')}
              </Label>
              <Input
                type="password"
                className={inputClass}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              {editing ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('views.userInfo.passwordLeaveBlank')}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {t('views.userInfo.labels.confirmPassword')}
              </Label>
              <Input
                type="password"
                className={inputClass}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
