import React from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  FileText, 
  Calendar, 
  Settings,
  LogOut,
  Search,
  Bell,
  UserCircle,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { t } = useTranslation();
  const menuItems = [
    { id: 'dashboard', label: t('nav.menu.dashboard'), icon: LayoutDashboard },
    { id: 'units', label: t('nav.menu.units'), icon: Building2 },
    { id: 'contracts', label: t('nav.menu.contracts'), icon: FileText },
    { id: 'crm', label: t('nav.menu.crm'), icon: Users },
    { id: 'ledger', label: t('nav.menu.ledger'), icon: FileText },
    { id: 'calendar', label: t('nav.menu.calendar'), icon: Calendar },
    { id: 'agentPortal', label: t('nav.menu.agentPortal'), icon: Briefcase },
    { id: 'portal', label: t('nav.menu.portal'), icon: UserCircle },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 w-64 border-r border-slate-800">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">P</div>
          <span className="text-xl font-bold text-white tracking-tight">3CORE</span>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'portal') {
                  const url = `${window.location.origin}${window.location.pathname}?view=portal`;
                  window.open(url, '_blank');
                  return;
                }
                if (item.id === 'agentPortal') {
                  const url = `${window.location.origin}${window.location.pathname}?view=agent-portal`;
                  window.open(url, '_blank');
                  return;
                }
                setActiveTab(item.id);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === item.id 
                  ? "bg-indigo-600 text-white" 
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-800">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-800 hover:text-white transition-colors">
          <Settings className="w-4 h-4" />
          {t('nav.settings')}
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-rose-400 hover:bg-rose-900/20 transition-colors mt-1">
          <LogOut className="w-4 h-4" />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );
}

export function TopNav() {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language;

  return (
    <header className="h-16 border-bottom bg-white flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder={t('header.searchPlaceholder')}
            className="pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1 rounded-md border border-slate-200 p-1">
          <span className="sr-only">{t('header.languageLabel')}</span>
          <Button
            variant={currentLanguage === 'en' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-2"
            onClick={() => i18n.changeLanguage('en')}
          >
            EN
          </Button>
          <Button
            variant={currentLanguage === 'ko' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-2"
            onClick={() => i18n.changeLanguage('ko')}
          >
            KO
          </Button>
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </Button>
        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900">RJ Manapsal</p>
            <p className="text-xs text-slate-500">{t('header.role')}</p>
          </div>
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>RM</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
