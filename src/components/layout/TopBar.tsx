import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Bot,
  ChevronDown,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
  WifiOff,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { NavSection } from '../../types/nexus';
import { NotificationCenter } from './NotificationCenter';

const SECTION_TITLES: Record<NavSection, string> = {
  dashboard: 'Executive Overview',
  crm: 'Customer Relationships',
  projects: 'Projects & Kanban',
  finance: 'Financial Ledger & P&L',
  tasks: 'Task Queue',
  settings: 'Workspace & Security',
};

interface TopBarProps {
  onOpenAuth: () => void;
}

export function TopBar({ onOpenAuth }: TopBarProps) {
  const {
    activeSection,
    setActiveSection,
    setMobileNavOpen,
    setCommandPaletteOpen,
    copilotOpen,
    setCopilotOpen,
    themePreference,
    resolvedTheme,
    setThemePreference,
    isOnline,
    notifications,
    userProfile,
    isDemoMode,
    logout,
  } = useWorkspace();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cycleTheme = () => {
    const order: Array<'system' | 'dark' | 'light'> = ['system', 'dark', 'light'];
    const idx = order.indexOf(themePreference);
    setThemePreference(order[(idx + 1) % order.length]);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-[#0B0D12]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#232838] px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
      {/* Zone 1: Menu toggle + Section breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0 text-sm">
          <span className="hidden sm:inline text-slate-400 dark:text-slate-500">NEXUS</span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-600">/</span>
          <h1 className="font-display font-semibold text-slate-900 dark:text-slate-100 truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
        </div>
      </div>

      {/* Zone 2: Global Search trigger */}
      <div className="hidden md:flex flex-1 max-w-md justify-center">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg text-xs text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-[#131620] border border-slate-200 dark:border-[#232838] hover:border-violet-500/50 transition-colors"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Search customers, projects, tasks, ledger...</span>
          </span>
          <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838] shrink-0">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Zone 3: Action Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {!isOnline && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 px-2 py-1">
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Offline</span>
          </span>
        )}

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Global search"
          className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={cycleTheme}
          title={`Theme: ${themePreference} (${resolvedTheme})`}
          aria-label={`Switch theme (current: ${themePreference})`}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          {themePreference === 'system' ? (
            <Monitor className="w-4 h-4" />
          ) : resolvedTheme === 'dark' ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
        </button>

        {/* Notification Centre */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            aria-label="Notifications"
            className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-violet-600 text-white font-mono text-[10px] font-semibold flex items-center justify-center tabular-nums">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && <NotificationCenter onClose={() => setNotifOpen(false)} />}
        </div>

        {/* AI Operations Copilot Trigger */}
        <button
          type="button"
          onClick={() => setCopilotOpen(!copilotOpen)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            copilotOpen
              ? 'bg-violet-600 text-white'
              : 'bg-violet-600/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 hover:bg-violet-600/20'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">AI Copilot</span>
        </button>

        {/* User Profile Menu */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileMenuOpen((o) => !o)}
            className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <img
              src={userProfile.photoURL || '/src/assets/images/avatar_nexus_operator_1795216108965.jpg'}
              alt={userProfile.displayName}
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-[#232838]"
            />
            <span className="hidden xl:inline text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
              {userProfile.displayName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {profileMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] shadow-xl p-2 z-50">
              <div className="px-3 py-2 border-b border-slate-200 dark:border-[#232838]">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {userProfile.displayName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {userProfile.email}
                </p>
                <p className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 mt-1">
                  {isDemoMode ? 'DEMO SANDBOX · NOT AUTHENTICATED' : `ROLE: ${userProfile.role.toUpperCase()}`}
                </p>
              </div>
              <div className="pt-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('settings');
                    setProfileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Profile & Preferences
                </button>
                {isDemoMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onOpenAuth();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Sign In / Connect Firebase
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
