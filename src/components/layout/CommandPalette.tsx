import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, CheckSquare, DollarSign, Search, Users } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { NavSection } from '../../types/nexus';
import { formatCurrencyExact } from '../../utils/calculations';

interface SearchResult {
  id: string;
  section: NavSection;
  category: 'Customer' | 'Project' | 'Task' | 'Transaction';
  title: string;
  subtitle: string;
}

export function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setActiveSection,
    customers,
    projects,
    tasks,
    transactions,
    currency,
  } = useWorkspace();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [commandPaletteOpen]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    const out: SearchResult[] = [];

    for (const c of customers) {
      if (
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.segment.toLowerCase().includes(q)
      ) {
        out.push({
          id: `c_${c.id}`,
          section: 'crm',
          category: 'Customer',
          title: `${c.name} · ${c.company}`,
          subtitle: `${c.segment} · ${formatCurrencyExact(c.value, currency)}`,
        });
      }
    }

    for (const p of projects) {
      if (
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q)
      ) {
        out.push({
          id: `p_${p.id}`,
          section: 'projects',
          category: 'Project',
          title: p.title,
          subtitle: `${p.clientName} · Due ${p.deadline} · ${p.progress}%`,
        });
      }
    }

    for (const t of tasks) {
      if (
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q) ||
        t.priority.toLowerCase().includes(q)
      ) {
        out.push({
          id: `t_${t.id}`,
          section: 'tasks',
          category: 'Task',
          title: t.title,
          subtitle: `${t.assignee} · ${t.priority} · ${t.stage}`,
        });
      }
    }

    for (const tx of transactions) {
      if (
        !q ||
        tx.description.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        tx.date.includes(q)
      ) {
        out.push({
          id: `tx_${tx.id}`,
          section: 'finance',
          category: 'Transaction',
          title: tx.description,
          subtitle: `${tx.type} · ${formatCurrencyExact(tx.amount, currency)} · ${tx.date}`,
        });
      }
    }

    return out.slice(0, 14);
  }, [currency, customers, projects, query, tasks, transactions]);

  const navigateTo = (res: SearchResult) => {
    setActiveSection(res.section);
    setCommandPaletteOpen(false);
  };

  useEffect(() => {
    if (!commandPaletteOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (results.length ? (i + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        navigateTo(results[selectedIndex]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commandPaletteOpen, results, selectedIndex, setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  const iconFor = (cat: SearchResult['category']) => {
    if (cat === 'Customer') return <Users className="w-4 h-4 text-cyan-500" />;
    if (cat === 'Project') return <Briefcase className="w-4 h-4 text-violet-500" />;
    if (cat === 'Task') return <CheckSquare className="w-4 h-4 text-amber-500" />;
    return <DollarSign className="w-4 h-4 text-emerald-500" />;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-slate-950/65 backdrop-blur-[2px] no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Global search command palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) setCommandPaletteOpen(false);
      }}
    >
      <div className="w-full max-w-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-[#232838]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search customers, projects, tasks, and financial transactions..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-[#232838]">
          {results.length === 0 ? (
            <div className="py-12 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
              No matching records found across Customers, Projects, Tasks, or Transactions.
            </div>
          ) : (
            results.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between gap-4 px-4 py-3 text-left transition-colors ${
                  idx === selectedIndex
                    ? 'bg-violet-600/10 dark:bg-violet-500/15'
                    : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0">{iconFor(item.category)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
