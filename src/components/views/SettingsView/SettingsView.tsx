import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Moon, Settings, Shield, Sun, User, Bell, Paintbrush } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProfileAvatarHoverPreview } from '@/components/ProfileAvatarHoverPreview';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { SessionPayload } from '@/types/session';
import { applyTheme, getInitialTheme, type AppThemeMode } from '@/lib/theme';
import { Checkbox } from '@/components/ui/checkbox';
import {
  loadNotificationPreferences,
  NOTIFICATION_TYPES,
  saveNotificationPreferences,
  subscribeNotificationPreferences,
  type NotificationPreferences,
  type NotificationTypeFilter,
} from '@/lib/notificationPreferences';

const IN_APP_TYPE_LABELS: Record<NotificationTypeFilter, string> = {
  lease: 'Lease & contracts',
  payment: 'Payments',
  maintenance: 'Maintenance',
  success: 'Completed actions',
};

export function SettingsView() {
  const { t } = useTranslation();
  const { session, applySession } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const [notifyPrefs, setNotifyPrefs] = useState<NotificationPreferences>(loadNotificationPreferences);

  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [appearanceMode, setAppearanceMode] = useState<AppThemeMode>(() => getInitialTheme());

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    return subscribeNotificationPreferences(() => setNotifyPrefs(loadNotificationPreferences()));
  }, []);

  useEffect(() => {
    if (!session) return;
    setProfileFirstName(session.user.firstName);
    setProfileLastName(session.user.lastName);
  }, [session]);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setAppearanceMode(root.classList.contains('dark') ? 'dark' : 'light');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  function commitNotificationPrefs(next: NotificationPreferences) {
    saveNotificationPreferences(next);
    setNotifyPrefs(next);
  }

  const applyAppearanceMode = useCallback((mode: AppThemeMode) => {
    applyTheme(mode);
    setAppearanceMode(mode);
    toast.success(mode === 'dark' ? 'Dark mode enabled' : 'Light mode enabled');
  }, []);

  const profileDirty =
    session != null &&
    (profileFirstName.trim() !== session.user.firstName ||
      profileLastName.trim() !== session.user.lastName);

  const profilePreviewName =
    `${profileFirstName.trim()} ${profileLastName.trim()}`.trim() || session?.user.username || '';

  const profileInitials = (() => {
    const name = profilePreviewName;
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
    return name.slice(0, 2).toUpperCase() || 'U';
  })();

  async function handleProfilePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !session) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await apiFetch<{ session: SessionPayload }>('/api/auth/profile-photo', {
        method: 'POST',
        body: fd,
      });
      applySession(data.session);
      toast.success('Photo updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload photo.');
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleRemoveProfilePhoto() {
    if (!session?.user.avatarUrl) return;
    setPhotoUploading(true);
    try {
      const data = await apiFetch<{ session: SessionPayload }>('/api/auth/profile-photo', {
        method: 'DELETE',
      });
      applySession(data.session);
      toast.success('Photo removed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove photo.');
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    const fn = profileFirstName.trim();
    const ln = profileLastName.trim();
    if (!fn || !ln) {
      toast.error('First and last name are required.');
      return;
    }
    setProfileSaving(true);
    try {
      const data = await apiFetch<{ session: SessionPayload }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: fn, lastName: ln }),
      });
      applySession(data.session);
      toast.success('Profile updated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save profile.';
      toast.error(message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 4) {
      toast.error('New password must be at least 4 characters.');
      return;
    }
    setPasswordSaving(true);
    try {
      await apiFetch<{ ok: boolean }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast.success('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update password.';
      toast.error(message);
    } finally {
      setPasswordSaving(false);
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Paintbrush },
  ];

  return (
    <div className="w-full animate-in fade-in duration-300">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between mb-6 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-700">
              <Settings className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
                {t('nav.settings') || 'Settings'}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Manage your account settings and preferences.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-64 shrink-0">
            <nav className="flex flex-col space-y-1">
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left",
                      active 
                        ? "bg-slate-100/80 text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    )}
                  >
                    <tab.icon className={cn("h-4 w-4 shrink-0", active ? "text-slate-900" : "text-slate-400")} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="flex-1 max-w-3xl">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Profile</h2>
                  <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
                    Your name appears in the header and across the app. Username is managed by an administrator.
                  </p>
                </div>

                {!session ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Sign in to edit your profile.</p>
                ) : (
                  <form onSubmit={handleSaveProfile} className="space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="flex flex-col items-start gap-3">
                        <ProfileAvatarHoverPreview
                          avatarUrl={session.user.avatarUrl}
                          initials={profileInitials}
                          avatarClassName="h-20 w-20 border border-slate-200 dark:border-slate-700"
                          fallbackClassName="bg-slate-100 text-xl font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          previewClassName="h-52 w-52 min-h-52 min-w-52 sm:h-56 sm:w-56 sm:min-h-56 sm:min-w-56"
                        />
                        <input
                          ref={profilePhotoInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          aria-label="Upload profile photo"
                          onChange={handleProfilePhotoChange}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            disabled={photoUploading}
                            onClick={() => profilePhotoInputRef.current?.click()}
                          >
                            {photoUploading ? 'Working…' : 'Upload photo'}
                          </Button>
                          {session.user.avatarUrl ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="rounded-lg text-slate-600 dark:text-slate-400"
                              disabled={photoUploading}
                              onClick={() => void handleRemoveProfilePhoto()}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                        <p className="text-[13px] text-slate-500 dark:text-slate-400 max-w-xs">
                          JPEG, PNG, WebP, or GIF — max 2MB. Saved as a 256×256 preview.
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {profilePreviewName || session.user.username}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{session.role.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          Branch #{session.branchId}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 max-w-md">
                      <Label htmlFor="profile-username">Username</Label>
                      <Input
                        id="profile-username"
                        readOnly
                        value={session.user.username}
                        className="rounded-xl bg-slate-50 dark:bg-slate-950/50"
                      />
                      <p className="text-[13px] text-slate-500 dark:text-slate-400">
                        Used to sign in. Contact an admin to change it.
                      </p>
                    </div>

                    <div className="grid gap-2 max-w-md">
                      <Label htmlFor="profile-first-name">First name</Label>
                      <Input
                        id="profile-first-name"
                        autoComplete="given-name"
                        value={profileFirstName}
                        onChange={(e) => setProfileFirstName(e.target.value)}
                        className="rounded-xl"
                        maxLength={128}
                      />
                    </div>
                    <div className="grid gap-2 max-w-md">
                      <Label htmlFor="profile-last-name">Last name</Label>
                      <Input
                        id="profile-last-name"
                        autoComplete="family-name"
                        value={profileLastName}
                        onChange={(e) => setProfileLastName(e.target.value)}
                        className="rounded-xl"
                        maxLength={128}
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={profileSaving || !profileDirty}
                        className="bg-indigo-600 hover:bg-indigo-700 rounded-lg px-5"
                      >
                        {profileSaving ? 'Saving…' : 'Save changes'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-8">
                <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Notifications</h2>
                  <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
                    Choose what appears in the header bell and which email alerts you want when those features are enabled on the server.
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    Preferences save automatically in this browser.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">In-app</h3>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                    <Checkbox
                      checked={notifyPrefs.inAppMaster}
                      onCheckedChange={(v) =>
                        commitNotificationPrefs({ ...notifyPrefs, inAppMaster: Boolean(v) })
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                        In-app notifications
                      </span>
                      <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                        Show alerts in the bell menu and unread badge. Turn off to hide all in-app alerts.
                      </span>
                    </span>
                  </label>

                  <div className="space-y-3 pl-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Categories
                    </p>
                    {NOTIFICATION_TYPES.map((type) => (
                      <label
                        key={type}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2 py-2',
                          !notifyPrefs.inAppMaster && 'pointer-events-none opacity-50',
                        )}
                      >
                        <Checkbox
                          checked={notifyPrefs.inAppByType[type]}
                          disabled={!notifyPrefs.inAppMaster}
                          onCheckedChange={(v) =>
                            commitNotificationPrefs({
                              ...notifyPrefs,
                              inAppByType: { ...notifyPrefs.inAppByType, [type]: Boolean(v) },
                            })
                          }
                          className="mt-0.5"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {IN_APP_TYPE_LABELS[type]}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Email (when available)</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Stored on this device for future integration with outgoing mail and digests.
                  </p>
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2">
                      <Checkbox
                        checked={notifyPrefs.emailPayments}
                        onCheckedChange={(v) =>
                          commitNotificationPrefs({ ...notifyPrefs, emailPayments: Boolean(v) })
                        }
                        className="mt-0.5"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Payment reminders & receipts</span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2">
                      <Checkbox
                        checked={notifyPrefs.emailLeaseContracts}
                        onCheckedChange={(v) =>
                          commitNotificationPrefs({ ...notifyPrefs, emailLeaseContracts: Boolean(v) })
                        }
                        className="mt-0.5"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Lease & contract updates</span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2">
                      <Checkbox
                        checked={notifyPrefs.emailMaintenance}
                        onCheckedChange={(v) =>
                          commitNotificationPrefs({ ...notifyPrefs, emailMaintenance: Boolean(v) })
                        }
                        className="mt-0.5"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Maintenance requests</span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2">
                      <Checkbox
                        checked={notifyPrefs.emailWeeklyDigest}
                        onCheckedChange={(v) =>
                          commitNotificationPrefs({ ...notifyPrefs, emailWeeklyDigest: Boolean(v) })
                        }
                        className="mt-0.5"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Weekly summary digest</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Security</h2>
                  <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">Manage your password and security preferences.</p>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-5 max-w-md">
                  <div className="grid gap-2">
                    <Label htmlFor="current-password">Current password</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="rounded-xl pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        onClick={() => setShowCurrentPw((v) => !v)}
                        aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
                      >
                        {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-password">New password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPw ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="rounded-xl pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        onClick={() => setShowNewPw((v) => !v)}
                        aria-label={showNewPw ? 'Hide new password' : 'Show new password'}
                      >
                        {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[13px] text-slate-500 dark:text-slate-400">At least 4 characters.</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input
                      id="confirm-password"
                      type={showNewPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="pt-1">
                    <Button
                      type="submit"
                      disabled={passwordSaving}
                      className="rounded-lg bg-indigo-600 hover:bg-indigo-700"
                    >
                      {passwordSaving ? 'Updating…' : 'Update password'}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Appearance</h2>
                  <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">Customize the look and feel of the application.</p>
                </div>
                <div className="space-y-3">
                  <Label className="text-slate-700 dark:text-slate-300">Theme</Label>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Same setting as the header toggle. Affects this app only—your choice is remembered next time you open it.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={appearanceMode === 'light' ? 'default' : 'outline'}
                      className={cn(
                        'rounded-xl gap-2',
                        appearanceMode === 'light' && 'bg-indigo-600 hover:bg-indigo-700',
                      )}
                      onClick={() => applyAppearanceMode('light')}
                    >
                      <Sun className="h-4 w-4" aria-hidden />
                      Light
                    </Button>
                    <Button
                      type="button"
                      variant={appearanceMode === 'dark' ? 'default' : 'outline'}
                      className={cn(
                        'rounded-xl gap-2',
                        appearanceMode === 'dark' && 'bg-indigo-600 hover:bg-indigo-700',
                      )}
                      onClick={() => applyAppearanceMode('dark')}
                    >
                      <Moon className="h-4 w-4" aria-hidden />
                      Dark
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
