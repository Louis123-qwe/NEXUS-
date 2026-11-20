import React, { useState } from 'react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ToastContainer } from './components/ui/ToastContainer';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { CommandPalette } from './components/layout/CommandPalette';
import { DashboardView } from './components/modules/DashboardView';
import { CrmView } from './components/modules/CrmView';
import { ProjectsView } from './components/modules/ProjectsView';
import { FinanceView } from './components/modules/FinanceView';
import { TasksView } from './components/modules/TasksView';
import { SettingsView } from './components/modules/SettingsView';
import { AiCopilotDrawer } from './components/modules/AiCopilotDrawer';
import { AuthModal } from './components/modules/AuthModal';

function NexusShell() {
  const { activeSection, dataError, toasts, dismissToast } = useWorkspace();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B0D12] text-slate-900 dark:text-slate-100">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onOpenAuth={() => setAuthModalOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {dataError && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400"
            >
              Firestore synchronization notice: {dataError}
            </div>
          )}

          {activeSection === 'dashboard' && (
            <DashboardView onOpenAuth={() => setAuthModalOpen(true)} />
          )}
          {activeSection === 'crm' && <CrmView />}
          {activeSection === 'projects' && <ProjectsView />}
          {activeSection === 'finance' && <FinanceView />}
          {activeSection === 'tasks' && <TasksView />}
          {activeSection === 'settings' && (
            <SettingsView onOpenAuth={() => setAuthModalOpen(true)} />
          )}
        </main>
      </div>

      <CommandPalette />
      <AiCopilotDrawer />
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <NexusShell />
      </WorkspaceProvider>
    </ErrorBoundary>
  );
}
