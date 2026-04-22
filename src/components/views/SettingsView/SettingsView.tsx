import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, User, Bell, Shield, Paintbrush } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function SettingsView() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Paintbrush },
  ];

  return (
    <div className="w-full animate-in fade-in duration-300">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Settings className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {t('nav.settings') || 'Settings'}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
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
                        ? "bg-slate-100/80 text-slate-900 shadow-sm" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
                  <p className="text-sm text-slate-500 mt-1">This is how others will see you on the site.</p>
                </div>
                <div className="space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input id="first-name" placeholder="First Name" defaultValue="System" className="max-w-md rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input id="last-name" placeholder="Last Name" defaultValue="Admin" className="max-w-md rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="Email" defaultValue="admin@realstate.com" className="max-w-md rounded-xl" />
                    <p className="text-[13px] text-slate-500">
                      Your email address is used for sign-in and notifications.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-lg px-5">Save changes</Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
                  <p className="text-sm text-slate-500 mt-1">Configure how you receive alerts and updates.</p>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-slate-500 italic">Notification settings coming soon.</p>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-semibold text-slate-900">Security</h2>
                  <p className="text-sm text-slate-500 mt-1">Manage your password and security preferences.</p>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-slate-500 italic">Security settings coming soon.</p>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-semibold text-slate-900">Appearance</h2>
                  <p className="text-sm text-slate-500 mt-1">Customize the look and feel of the application.</p>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-slate-500 italic">Appearance settings coming soon.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
