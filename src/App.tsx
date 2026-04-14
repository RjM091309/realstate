/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Sidebar, TopNav } from './components/Navigation';
import { DashboardView } from './components/views/DashboardView/index';
import { UnitsView } from './components/views/UnitsView/index';
import { ContractsView } from './components/views/ContractsView/index';
import { CRMView } from './components/views/CRMView/index';
import { LeaseLedgerView } from './components/views/LeaseLedgerView/index';
import { CalendarView } from './components/views/CalendarView/index';
import { UserAccessView } from './components/views/UserAccessView/index';
import { TenantPortalView } from './components/views/TenantPortalView/index';
import { AgentPortalView } from './components/views/AgentPortalView/index';
import { DocumentPreview } from './components/DocumentPreview';
import { LoginView } from './components/LoginView';
import { useAuth } from './context/AuthContext';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const isPreview = urlParams.get('view') === 'preview';
  const isPortalPage = urlParams.get('view') === 'portal';
  const isAgentPortalPage = urlParams.get('view') === 'agent-portal';
  const previewType = urlParams.get('type') as 'contract' | 'invoice';
  const previewId = urlParams.get('id');

  if (isPreview && previewType && previewId) {
    return (
      <DocumentPreview type={previewType} contractId={previewId} isStandalone />
    );
  }

  if (isPortalPage) {
    return <TenantPortalView />;
  }

  if (isAgentPortalPage) {
    return <AgentPortalView />;
  }

  return <MainApp />;
}

function MainApp() {
  const { session, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const isAdmin = session?.role.id === 1;

  useEffect(() => {
    if (!session?.sidebarTabIds?.length) return;
    if (activeTab === 'access' && isAdmin) return;
    if (!session.sidebarTabIds.includes(activeTab)) {
      setActiveTab(session.sidebarTabIds[0]!);
    }
  }, [session, activeTab, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-600">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" aria-hidden />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <LoginView />;
  }

  const displayName = `${session.user.firstName} ${session.user.lastName}`.trim() || session.user.username;

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
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        allowedTabIds={session.sidebarTabIds}
        isAdmin={isAdmin}
        onLogout={logout}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopNav displayName={displayName} roleLabel={session.role.name} />

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-8 custom-scrollbar">
          <div className="mx-auto w-full max-w-[min(100%,100rem)]">{renderView()}</div>
        </main>
      </div>
    </div>
  );
}
