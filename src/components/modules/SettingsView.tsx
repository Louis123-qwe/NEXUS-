import React, { useState } from 'react';
import {
  Download,
  LogIn,
  LogOut,
  RotateCcw,
  Shield,
  Upload,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { CurrencyCode, ThemePreference } from '../../types/nexus';

export function SettingsView({ onOpenAuth }: { onOpenAuth: () => void }) {
  const {
    userProfile,
    isDemoMode,
    firebaseReachable,
    isOnline,
    themePreference,
    setThemePreference,
    currency,
    setCurrency,
    updateOperatorProfile,
    exportWorkspaceJson,
    importWorkspaceJson,
    resetDemo,
    logout,
    activityLogs,
    pushToast,
  } = useWorkspace();

  const [displayName, setDisplayName] = useState(userProfile.displayName.replace(' (Demo)', ''));

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateOperatorProfile(displayName);
  };

  const handleDownloadBackup = () => {
    const json = exportWorkspaceJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast({ title: 'Workspace JSON exported', variant: 'success' });
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      importWorkspaceJson(String(reader.result));
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Auth & Security Posture */}
      <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Authentication & Data Synchronization
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {isDemoMode
              ? 'Currently running in unauthenticated Local Demo Sandbox mode. Sign in with Firebase to persist encrypted multi-session data in Cloud Firestore.'
              : `Signed in as ${userProfile.email} (Role: ${userProfile.role}) · Firestore server ${firebaseReachable ? 'reachable' : 'offline'} · Network ${isOnline ? 'online' : 'offline'}.`}
          </p>
        </div>

        {isDemoMode ? (
          <button
            type="button"
            onClick={onOpenAuth}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white whitespace-nowrap shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In with Firebase
          </button>
        ) : (
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        )}
      </div>

      {/* Profile & Preferences */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <form
          onSubmit={handleSaveProfile}
          className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Operator Profile
          </h3>
          <div>
            <label className="block text-xs font-medium mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Assigned Role</label>
            <input
              type="text"
              readOnly
              value={isDemoMode ? 'Demo Sandbox Admin (Local Only)' : userProfile.role}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838] text-slate-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white"
          >
            Save Profile
          </button>
        </form>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Workspace Preferences
          </h3>
          <div>
            <label className="block text-xs font-medium mb-1.5">Theme Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {(['system', 'dark', 'light'] as ThemePreference[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setThemePreference(t)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium capitalize border transition-colors ${
                    themePreference === t
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'border-slate-200 dark:border-[#232838] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Reporting Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Import & Export */}
      <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Data Portability & Sandbox Controls
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Export a full JSON snapshot of customers, projects, tasks, and ledger transactions, or
            restore from an archive.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#232838] hover:bg-slate-50 dark:hover:bg-white/5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Workspace JSON
          </button>

          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#232838] hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Import Workspace JSON
            <input
              type="file"
              accept="application/json"
              onChange={handleImportBackup}
              className="sr-only"
            />
          </label>

          {isDemoMode && (
            <button
              type="button"
              onClick={resetDemo}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/10"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo Sandbox
            </button>
          )}
        </div>
      </div>

      {/* Activity Logs */}
      <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Operational Activity Audit Log
        </h3>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#232838] text-[11px] text-slate-500">
                <th className="py-2 pr-4">Actor</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Module</th>
                <th className="py-2 pr-4">Summary</th>
                <th className="py-2 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#232838]">
              {activityLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 pr-4 font-medium">{log.actor}</td>
                  <td className="py-2 pr-4 text-cyan-600 dark:text-cyan-400">{log.action}</td>
                  <td className="py-2 pr-4">{log.entityType}</td>
                  <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{log.summary}</td>
                  <td className="py-2 text-right font-mono text-slate-400">
                    {String(log.createdAt || '').slice(0, 10)}
                  </td>
                </tr>
              ))}
              {activityLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No audit entries recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
