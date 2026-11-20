import React from 'react';
import {
  BarChart3,
  Briefcase,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { NavSection } from '../../types/nexus';

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Overview', icon: BarChart3 },
  { id: 'crm', label: 'Customers', icon: Users },
  { id: 'projects', label: 'Projects', icon: Briefcase },
  { id: 'finance', label: 'Financials', icon: DollarSign },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const {
    activeSection,
    setActiveSection,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavOpen,
    setMobileNavOpen,
    isDemoMode,
    tasks,
  } = useWorkspace();

  const openTaskCount = tasks.filter((t) => !t.completed).length;

  const handleSelect = (id: NavSection) => {
    setActiveSection(id);
    setMobileNavOpen(false);
  };

  const navContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full bg-white dark:bg-[#10131C] border-r border-slate-200 dark:border-[#232838] select-none">
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-[#232838]">
        <button
          type="button"
          onClick={() => handleSelect('dashboard')}
          className="flex items-center gap-2.5 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-md"
        >
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white font-display font-bold text-sm shrink-0">
            N
          </span>
          {!collapsed && (
            <span className="font-display font-bold text-lg tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
              NEXUS
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSidebarCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                active
                  ? 'bg-violet-600/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-violet-600 dark:text-violet-400' : ''
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </span>
              {!collapsed && item.id === 'tasks' && openTaskCount > 0 && (
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {openTaskCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200 dark:border-[#232838]">
        <button
          type="button"
          onClick={() => handleSelect('settings')}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <span className="font-mono font-medium text-cyan-600 dark:text-cyan-400 shrink-0">
            {isDemoMode ? 'DEMO' : 'LIVE'}
          </span>
          {!collapsed && (
            <span className="truncate">
              {isDemoMode ? 'Local Demo Sandbox' : 'Firestore Sync Active'}
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-150 no-print ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[244px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{navContent(sidebarCollapsed)}</div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">{navContent(false)}</div>
        </div>
      )}
    </>
  );
}
