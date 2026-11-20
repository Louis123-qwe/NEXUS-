import React, { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import {
  ArrowDownRight,
  ArrowUpRight,
  Database,
  LogIn,
  Square,
  Volume2,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  buildCategoryBreakdown,
  buildPerformanceSeries,
  computeDashboardMetrics,
  formatCurrency,
} from '../../utils/calculations';
import { TimeGranularity } from '../../types/nexus';
import { KpiSkeletonGrid } from '../ui/Skeletons';

function useAnimatedNumber(target: number, duration = 450): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplay(target);
      prevRef.current = target;
      return;
    }

    const start = prevRef.current;
    const diff = target - start;
    if (Math.abs(diff) < 0.01) {
      setDisplay(target);
      return;
    }

    let raf = 0;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(start + diff * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

export function DashboardView({ onOpenAuth }: { onOpenAuth: () => void }) {
  const {
    transactions,
    projects,
    customers,
    tasks,
    activityLogs,
    dateFilter,
    setDateFilter,
    currency,
    resolvedTheme,
    isDemoMode,
    loadingData,
    seedLiveWorkspace,
    setActiveSection,
    pushToast,
  } = useWorkspace();

  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const perfCanvasRef = useRef<HTMLCanvasElement>(null);
  const catCanvasRef = useRef<HTMLCanvasElement>(null);
  const segCanvasRef = useRef<HTMLCanvasElement>(null);

  const metrics = useMemo(
    () => computeDashboardMetrics(transactions, projects, customers, tasks, dateFilter),
    [transactions, projects, customers, tasks, dateFilter]
  );

  const series = useMemo(
    () => buildPerformanceSeries(transactions, dateFilter),
    [transactions, dateFilter]
  );

  const categoryBreakdown = useMemo(
    () => buildCategoryBreakdown(transactions).slice(0, 6),
    [transactions]
  );

  const segmentCounts = useMemo(
    () => ({
      lead: customers.filter((c) => c.segment === 'lead').length,
      prospect: customers.filter((c) => c.segment === 'prospect').length,
      active: customers.filter((c) => c.segment === 'active').length,
      inactive: customers.filter((c) => c.segment === 'inactive').length,
    }),
    [customers]
  );

  const animRevenue = useAnimatedNumber(metrics.totalRevenue);
  const animExpenses = useAnimatedNumber(metrics.totalExpenses);
  const animProfit = useAnimatedNumber(metrics.netProfit);
  const animProjects = useAnimatedNumber(metrics.activeProjectsCount);
  const animCustomers = useAnimatedNumber(metrics.totalCustomers);
  const animConversion = useAnimatedNumber(metrics.conversionRatePct);
  const animGrowth = useAnimatedNumber(metrics.revenueGrowthPct);

  // Performance Chart
  useEffect(() => {
    const canvas = perfCanvasRef.current;
    if (!canvas) return;
    const isDark = resolvedTheme === 'dark';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(15, 23, 42, 0.08)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const chart = new Chart(canvas, {
      type: chartType,
      data: {
        labels: series.labels,
        datasets: [
          {
            label: 'Revenue',
            data: series.revenue,
            borderColor: '#7c3aed',
            backgroundColor: chartType === 'bar' ? 'rgba(124, 58, 237, 0.78)' : 'rgba(124, 58, 237, 0.12)',
            tension: 0.32,
            fill: chartType === 'line',
            borderWidth: 2,
          },
          {
            label: 'Expenses',
            data: series.expenses,
            borderColor: '#06b6d4',
            backgroundColor: chartType === 'bar' ? 'rgba(6, 182, 212, 0.75)' : 'rgba(6, 182, 212, 0.08)',
            tension: 0.32,
            fill: chartType === 'line',
            borderWidth: 2,
          },
          {
            label: 'Net Profit',
            data: series.netProfit,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            tension: 0.32,
            borderDash: chartType === 'line' ? [5, 5] : undefined,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: textColor, boxWidth: 12, font: { family: 'DM Sans' } },
          },
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 11 } },
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'JetBrains Mono', size: 11 },
              callback: (v) => `$${Number(v).toLocaleString()}`,
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [series, chartType, resolvedTheme]);

  // Expense Category Doughnut Chart
  useEffect(() => {
    const canvas = catCanvasRef.current;
    if (!canvas) return;
    const isDark = resolvedTheme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const expenseCats = categoryBreakdown.filter((c) => c.expense > 0);

    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: expenseCats.length ? expenseCats.map((c) => c.category) : ['No Expenses'],
        datasets: [
          {
            data: expenseCats.length ? expenseCats.map((c) => c.expense) : [1],
            backgroundColor: ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#6366f1'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, boxWidth: 10, font: { size: 11 } },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [categoryBreakdown, resolvedTheme]);

  // CRM Pipeline Bar Chart
  useEffect(() => {
    const canvas = segCanvasRef.current;
    if (!canvas) return;
    const isDark = resolvedTheme === 'dark';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(15, 23, 42, 0.08)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Leads', 'Prospects', 'Active', 'Inactive'],
        datasets: [
          {
            label: 'Customers',
            data: [
              segmentCounts.lead,
              segmentCounts.prospect,
              segmentCounts.active,
              segmentCounts.inactive,
            ],
            backgroundColor: ['#06b6d4', '#8b5cf6', '#10b981', '#64748b'],
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { stepSize: 1, color: textColor, font: { family: 'JetBrains Mono', size: 11 } },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [segmentCounts, resolvedTheme]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayBriefing = async () => {
    if (ttsPlaying && audioRef.current) {
      audioRef.current.pause();
      setTtsPlaying(false);
      return;
    }

    setTtsLoading(true);
    try {
      const briefingText = `NEXUS Executive Briefing for ${dateFilter.granularity} view. Total revenue is ${formatCurrency(metrics.totalRevenue, currency)}, expenses are ${formatCurrency(metrics.totalExpenses, currency)}, leaving a net profit of ${formatCurrency(metrics.netProfit, currency)} at a ${metrics.profitMarginPct.toFixed(1)} percent margin. You have ${metrics.activeProjectsCount} active projects, ${metrics.overdueProjectsCount} overdue projects, ${metrics.activeCustomersCount} active customers out of ${metrics.totalCustomers} total accounts, and month-over-month revenue growth of ${metrics.revenueGrowthPct.toFixed(1)} percent.`;

      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: briefingText,
          voiceName: 'Kore',
          style: 'Executive chief of staff delivering a crisp morning financial briefing',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'TTS failed');

      const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setTtsPlaying(false);
      audio.onerror = () => setTtsPlaying(false);
      await audio.play();
      setTtsPlaying(true);
    } catch (err) {
      pushToast({
        title: 'Voice briefing unavailable',
        description: err instanceof Error ? err.message : 'Unable to generate audio briefing.',
        variant: 'error',
      });
    } finally {
      setTtsLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="space-y-6">
        <KpiSkeletonGrid />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode Banner */}
      {isDemoMode ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              Demo Sandbox Mode · Sample Data Active
            </p>
            <p>
              Changes persist in your browser locally and are not authenticated against a remote server.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAuth}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white whitespace-nowrap shrink-0 transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In for Live Sync
          </button>
        </div>
      ) : (
        customers.length === 0 &&
        transactions.length === 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Connected to Cloud Firestore.
              </span>{' '}
              Your workspace is empty—seed realistic sample records to explore analytics immediately.
            </div>
            <button
              type="button"
              onClick={() => seedLiveWorkspace()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white whitespace-nowrap shrink-0 transition-colors"
            >
              <Database className="w-3.5 h-3.5" />
              Seed Starter Data
            </button>
          </div>
        )
      )}

      {/* Filter Bar + Audio Briefing */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
            {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as TimeGranularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setDateFilter((prev) => ({ ...prev, granularity: g }))}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  dateFilter.granularity === g
                    ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {dateFilter.granularity === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] font-mono text-xs"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] font-mono text-xs"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePlayBriefing}
            disabled={ttsLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] text-slate-800 dark:text-slate-200 hover:border-violet-500/60 transition-colors whitespace-nowrap"
          >
            {ttsPlaying ? <Square className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-500" />}
            {ttsLoading ? 'Synthesizing Audio...' : ttsPlaying ? 'Stop Briefing' : 'Play Voice Briefing'}
          </button>
        </div>
      </div>

      {/* 8 Core KPI Cards (2 rows of 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Revenue</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatCurrency(Math.round(animRevenue), currency)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Scoped to {dateFilter.granularity} window
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Operating Expenses</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatCurrency(Math.round(animExpenses), currency)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Derived from verified ledger entries
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Net Profit</p>
          <p
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              metrics.netProfit >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatCurrency(Math.round(animProfit), currency)}
          </p>
          <p className="mt-2 text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {metrics.profitMarginPct.toFixed(1)}% operating margin
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Revenue Growth (MoM)</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {animGrowth >= 0 ? '+' : ''}
              {animGrowth.toFixed(1)}%
            </p>
            {metrics.revenueGrowthPct >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-500" />
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Current month vs prior month
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Active Projects</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {Math.round(animProjects)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {metrics.overdueProjectsCount > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                {metrics.overdueProjectsCount} overdue deadline
              </span>
            ) : (
              'All schedules on track'
            )}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Customer Acquisition</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {Math.round(animCustomers)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {metrics.activeCustomersCount} active accounts
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Conversion Rate</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
            {animConversion.toFixed(1)}%
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Leads & prospects to active
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Open Task Queue</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {metrics.openTasksCount}
          </p>
          <button
            type="button"
            onClick={() => setActiveSection('tasks')}
            className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
          >
            Open Kanban & Tasks
          </button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Revenue, Expenses & Net Performance
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Interactive Chart.js visualization · {dateFilter.granularity} resolution
              </p>
            </div>
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]">
              <button
                type="button"
                onClick={() => setChartType('line')}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  chartType === 'line'
                    ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white'
                    : 'text-slate-500'
                }`}
              >
                Line
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  chartType === 'bar'
                    ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white'
                    : 'text-slate-500'
                }`}
              >
                Bar
              </button>
            </div>
          </div>
          <div className="h-72">
            <canvas ref={perfCanvasRef} />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Expense Allocation
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Distribution by ledger category
          </p>
          <div className="h-72">
            <canvas ref={catCanvasRef} />
          </div>
        </div>
      </div>

      {/* Pipeline Chart & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Customer Segment Distribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Leads, prospects, active, and inactive accounts
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('crm')}
              className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              View CRM
            </button>
          </div>
          <div className="h-56">
            <canvas ref={segCanvasRef} />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Operational Activity
            </h2>
            <button
              type="button"
              onClick={() => setActiveSection('settings')}
              className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              Full Audit Log
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#232838]">
            {activityLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                    {log.summary}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {log.actor} · {log.action} {log.entityType}
                  </p>
                </div>
                <span className="font-mono text-[11px] text-slate-400 shrink-0">
                  {String(log.createdAt || '').slice(0, 10)}
                </span>
              </div>
            ))}
            {activityLogs.length === 0 && (
              <p className="text-xs text-slate-500 py-6 text-center">No activity logged yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
