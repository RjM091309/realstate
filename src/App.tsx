/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Sidebar, TopNav } from './components/Navigation';
import { DashboardView } from './components/views/DashboardView/index';
import { UnitsView } from './components/views/UnitsView/index';
import { ContractsView } from './components/views/ContractsView/index';
import { CRMView } from './components/views/CRMView/index';
import { LeaseLedgerView } from './components/views/LeaseLedgerView/index';
import { CalendarView } from './components/views/CalendarView/index';
import { UserAccessView } from './components/views/UserAccessView/index';
import { SettingsView } from './components/views/SettingsView/index';
import { TenantPortalView } from './components/views/TenantPortalView/index';
import { AgentPortalView } from './components/views/AgentPortalView/index';
import { DocumentPreview } from './components/DocumentPreview';
import { LoginView } from './components/LoginView';

export default function App() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const legacyView = params.get('view');
  const legacyType = params.get('type');
  const legacyId = params.get('id');
  const legacyTenantId = params.get('tenantId');

  // Backward compatibility for old query-string pages.
  if (legacyView === 'preview' && legacyType && legacyId) {
    return <Navigate to={`/preview?type=${encodeURIComponent(legacyType)}&id=${encodeURIComponent(legacyId)}`} replace />;
  }
  if (legacyView === 'portal') {
    const suffix = legacyTenantId ? `?tenantId=${encodeURIComponent(legacyTenantId)}` : '';
    return <Navigate to={`/portal${suffix}`} replace />;
  }
  if (legacyView === 'agent-portal') {
    return <Navigate to="/agent-portal" replace />;
  }

  return (
    <Routes>
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="/portal" element={<TenantPortalView />} />
      <Route path="/agent-portal" element={<AgentPortalView />} />
      <Route path="/*" element={<MainApp />} />
    </Routes>
  );
}

function MainApp() {
  const { session, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = session?.role.id === 1;
  const allowedTabIds = session?.sidebarTabIds ?? [];
  const tabToPath: Record<string, string> = {
    dashboard: '/dashboard',
    units: '/units',
    contracts: '/contracts',
    crm: '/crm',
    ledger: '/ledger',
    calendar: '/calendar',
    access: '/access',
    settings: '/settings',
  };
  const pathToTab = Object.entries(tabToPath).reduce((acc, [tab, path]) => {
    acc[path] = tab;
    return acc;
  }, {} as Record<string, string>);
  const activeTab = pathToTab[location.pathname] ?? 'dashboard';

  useEffect(() => {
    if (location.pathname === '/') {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (!allowedTabIds.length) return;

    const alwaysAllowedTabs = ['settings', ...(isAdmin ? ['access'] : [])];
    if (alwaysAllowedTabs.includes(activeTab)) return;

    if (!allowedTabIds.includes(activeTab)) {
      const fallback = allowedTabIds[0] ?? 'dashboard';
      navigate(tabToPath[fallback] ?? '/dashboard', { replace: true });
    }
  }, [location.pathname, allowedTabIds, isAdmin, activeTab, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" aria-hidden />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <LoginView />;
  }

  const setActiveTab = (tab: string) => {
    navigate(tabToPath[tab] ?? '/dashboard');
  };

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'units':
        return <UnitsView />;
      case 'contracts':
        return <ContractsView />;
      case 'crm':
        return <CRMView />;
      case 'ledger':
        return <LeaseLedgerView />;
      case 'calendar':
        return <CalendarView />;
      case 'access':
        return <UserAccessView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        allowedTabIds={allowedTabIds}
        isAdmin={isAdmin}
        onLogout={() => {
          navigate('/dashboard');
          logout();
        }}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
        <TopNav onOpenSettings={() => setActiveTab('settings')} onLogout={() => logout()} />
        
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50 dark:bg-slate-950">
          <div className="max-w-7xl mx-auto">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}

function PreviewPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const previewType = params.get('type') as 'contract' | 'invoice' | null;
  const previewId = params.get('id');

  if (!previewType || !previewId) {
    return <Navigate to="/dashboard" replace />;
  }

  return <DocumentPreview type={previewType} contractId={previewId} isStandalone />;
}
