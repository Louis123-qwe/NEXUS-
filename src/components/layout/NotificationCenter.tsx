import React, { useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { NotificationCategory } from '../../types/nexus';

export function NotificationCenter({ onClose }: { onClose: () => void }) {
  const { notifications, toggleNotificationRead, markAllNotificationsRead } = useWorkspace();
  const [filter, setFilter] = useState<'all' | 'unread' | NotificationCategory>('all');

  const filtered = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    return n.category === filter;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-[#232838]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</h3>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {unreadCount} unread
          </span>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllNotificationsRead()}
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-200 dark:border-[#232838] overflow-x-auto">
        {(['all', 'unread', 'deadline', 'task', 'finance'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize whitespace-nowrap transition-colors ${
              filter === tab
                ? 'bg-violet-600/15 text-violet-700 dark:text-violet-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-[#232838]">
        {filtered.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
            No notifications match this filter.
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className={`px-4 py-3 flex items-start justify-between gap-3 transition-colors ${
                n.read ? 'opacity-70' : 'bg-violet-500/[0.03]'
              }`}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="capitalize font-medium text-cyan-600 dark:text-cyan-400">
                    {n.category}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{n.read ? 'Read' : 'Unread'}</span>
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {n.title}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                  {n.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleNotificationRead(n.id, !n.read)}
                title={n.read ? 'Mark unread' : 'Mark read'}
                aria-label={n.read ? 'Mark notification unread' : 'Mark notification read'}
                className={`p-1.5 rounded-md border shrink-0 transition-colors ${
                  n.read
                    ? 'border-slate-200 dark:border-[#232838] text-slate-400 hover:text-slate-700'
                    : 'border-violet-500/40 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2 border-t border-slate-200 dark:border-[#232838] text-right">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Close
        </button>
      </div>
    </div>
  );
}
