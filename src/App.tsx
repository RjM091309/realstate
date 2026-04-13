/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { Sidebar, TopNav } from './components/Navigation';
import { DashboardView } from './components/views/DashboardView/index';
import { UnitsView } from './components/views/UnitsView/index';
import { ContractsView } from './components/views/ContractsView/index';
import { CRMView } from './components/views/CRMView/index';
import { LeaseLedgerView } from './components/views/LeaseLedgerView/index';
import { CalendarView } from './components/views/CalendarView/index';
import { TenantPortalView } from './components/views/TenantPortalView/index';
import { AgentPortalView } from './components/views/AgentPortalView/index';
import { DocumentPreview } from './components/DocumentPreview';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Error Boundary Component
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Check for standalone preview mode
  const urlParams = new URLSearchParams(window.location.search);
  const isPreview = urlParams.get('view') === 'preview';
  const isPortalPage = urlParams.get('view') === 'portal';
  const isAgentPortalPage = urlParams.get('view') === 'agent-portal';
  const previewType = urlParams.get('type') as 'contract' | 'invoice';
  const previewId = urlParams.get('id');

  if (isPreview && previewType && previewId) {
    return (
      <DocumentPreview 
        type={previewType} 
        contractId={previewId} 
        isStandalone 
      />
    );
  }

  if (isPortalPage) {
    return <TenantPortalView />;
  }

  if (isAgentPortalPage) {
    return <AgentPortalView />;
  }

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
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav />
        
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}
