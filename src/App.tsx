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
import { AddUnitByLocationView } from './components/views/AddUnitByLocationView/index';
import { FileMaintenanceView } from './components/views/FileMaintenanceView/index';
import { ContractsView } from './components/views/ContractsView/index';
import { CRMView } from './components/views/CRMView/CRMView';
import { MaintenanceView } from './components/views/MaintenanceView/index';
import { LeaseLedgerView } from './components/views/LeaseLedgerView/index';
import { CalendarView } from './components/views/CalendarView/index';
import { UserManagementView, UserRoleManagementView } from './components/views/UserManagementView/index';
import { UserAccessView } from './components/views/UserAccessView/index';
import { AuditLogsView } from './components/views/AuditLogsView/index';
import { SettingsView } from './components/views/SettingsView/index';
import { TenantPortalView } from './components/views/TenantPortalView/index';
import { AgentPortalView } from './components/views/AgentPortalView/index';
import { DocumentPreview } from './components/DocumentPreview';
import { LoginView } from './components/LoginView';

export default function App() {
  const { session, loading } = useAuth();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7F9] dark:bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
        <Loader2 className="h-10 w-10 animate-spin text-brand-blue" aria-hidden />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginView />} />
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
    addUnitByLocation: '/add-unit-by-location',
    fileMaintenance: '/file-maintenance',
    contracts: '/contracts',
    crm: '/crm',
    ledger: '/ledger',
    maintenance: '/maintenance',
    calendar: '/calendar',
    userManagement: '/user-management/user-info',
    settings: '/settings',
  };
  const tabPermissionOf = (tab: string) =>
    tab === 'addUnitByLocation' || tab === 'fileMaintenance' ? 'units' : tab;
  const pathToTab = Object.entries(tabToPath).reduce((acc, [tab, path]) => {
    acc[path] = tab;
    return acc;
  }, {} as Record<string, string>);
  const activeTab = location.pathname.startsWith('/user-management')
    ? 'userManagement'
    : pathToTab[location.pathname] ?? 'dashboard';

  useEffect(() => {
    if (location.pathname === '/') {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (location.pathname.startsWith('/user-management') && !isAdmin) {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (!allowedTabIds.length) return;

    const alwaysAllowedTabs = ['settings', ...(isAdmin ? ['userManagement'] : [])];
    if (alwaysAllowedTabs.includes(activeTab)) return;

    if (!allowedTabIds.includes(tabPermissionOf(activeTab))) {
      const fallback = allowedTabIds[0] ?? 'dashboard';
      navigate(tabToPath[fallback] ?? '/dashboard', { replace: true });
    }
  }, [location.pathname, allowedTabIds, isAdmin, activeTab, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7F9] dark:bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
        <Loader2 className="h-10 w-10 animate-spin text-brand-blue" aria-hidden />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname === '/access') {
    return <Navigate to="/user-management/control-panel" replace />;
  }
  if (location.pathname === '/user-management') {
    return <Navigate to="/user-management/user-info" replace />;
  }
  if (location.pathname === '/user-management/branches') {
    return <Navigate to="/user-management/user-info" replace />;
  }

  const setActiveTab = (tab: string) => {
    navigate(tabToPath[tab] ?? '/dashboard');
  };

  const renderView = () => {
    if (location.pathname.startsWith('/user-management')) {
      if (location.pathname === '/user-management/control-panel') {
        if (!isAdmin) {
          return <Navigate to="/user-management/user-info" replace />;
        }
        return <UserAccessView />;
      }
      if (location.pathname === '/user-management/user-role') {
        return <UserRoleManagementView />;
      }
      if (location.pathname === '/user-management/audit-logs') {
        if (!isAdmin) {
          return <Navigate to="/user-management/user-info" replace />;
        }
        return <AuditLogsView />;
      }
      return <UserManagementView />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'units':
        return <UnitsView />;
      case 'addUnitByLocation':
        return <AddUnitByLocationView />;
      case 'fileMaintenance':
        return <FileMaintenanceView />;
      case 'contracts':
        return <ContractsView />;
      case 'crm':
        return <CRMView />;
      case 'ledger':
        return <LeaseLedgerView />;
      case 'maintenance':
        return <MaintenanceView />;
      case 'calendar':
        return <CalendarView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F4F7F9] dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        allowedTabIds={allowedTabIds}
        isAdmin={isAdmin}
        onLogout={() => {
          navigate('/login');
          logout();
        }}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F4F7F9] dark:bg-slate-950">
        <TopNav onOpenSettings={() => setActiveTab('settings')} onLogout={() => logout()} />
        
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar light-scroll bg-[#F4F7F9] dark:bg-slate-950">
          <div className="max-w-screen-2xl mx-auto">
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
