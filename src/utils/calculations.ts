import {
  Budget,
  CurrencyCode,
  Customer,
  DateRangeFilter,
  Project,
  TaskItem,
  Transaction,
} from '../types/nexus';
import { escapeCsvCell } from './validation';

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export function formatCurrency(amount: number, currency: CurrencyCode = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '$';
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

export function formatCurrencyExact(amount: number, currency: CurrencyCode = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '$';
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

export function filterTransactionsByRange(
  transactions: Transaction[],
  filter: DateRangeFilter,
  referenceDateStr = '2026-11-20'
): Transaction[] {
  const refDate = new Date(`${referenceDateStr}T23:59:59`);
  return transactions.filter((tx) => {
    const txDate = new Date(`${tx.date}T12:00:00`);
    if (Number.isNaN(txDate.getTime())) return false;

    if (filter.granularity === 'custom') {
      const start = filter.startDate ? new Date(`${filter.startDate}T00:00:00`) : new Date(0);
      const end = filter.endDate ? new Date(`${filter.endDate}T23:59:59`) : refDate;
      return txDate >= start && txDate <= end;
    }

    if (filter.granularity === 'daily') {
      const cutoff = new Date(refDate);
      cutoff.setDate(cutoff.getDate() - 14);
      return txDate >= cutoff && txDate <= refDate;
    }

    if (filter.granularity === 'weekly') {
      const cutoff = new Date(refDate);
      cutoff.setDate(cutoff.getDate() - 84); // 12 weeks
      return txDate >= cutoff && txDate <= refDate;
    }

    if (filter.granularity === 'monthly') {
      const cutoff = new Date(refDate);
      cutoff.setMonth(cutoff.getMonth() - 11);
      cutoff.setDate(1);
      return txDate >= cutoff && txDate <= refDate;
    }

    // yearly: last 3 years
    const cutoff = new Date(refDate);
    cutoff.setFullYear(cutoff.getFullYear() - 2, 0, 1);
    return txDate >= cutoff && txDate <= refDate;
  });
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPct: number;
  activeProjectsCount: number;
  overdueProjectsCount: number;
  totalCustomers: number;
  activeCustomersCount: number;
  conversionRatePct: number;
  revenueGrowthPct: number;
  openTasksCount: number;
}

export function computeDashboardMetrics(
  transactions: Transaction[],
  projects: Project[],
  customers: Customer[],
  tasks: TaskItem[],
  filter: DateRangeFilter,
  todayStr = '2026-11-20'
): DashboardMetrics {
  const scopedTx = filterTransactionsByRange(transactions, filter, todayStr);
  const totalRevenue = scopedTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = scopedTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const activeProjectsCount = projects.filter(
    (p) => p.status === 'active' || p.status === 'planning'
  ).length;
  const overdueProjectsCount = projects.filter(
    (p) => p.status !== 'completed' && p.deadline < todayStr
  ).length;

  const totalCustomers = customers.length;
  const activeCustomersCount = customers.filter((c) => c.segment === 'active').length;
  const eligibleLeads = customers.filter(
    (c) => c.segment === 'active' || c.segment === 'prospect' || c.segment === 'lead'
  ).length;
  const conversionRatePct = eligibleLeads > 0 ? (activeCustomersCount / eligibleLeads) * 100 : 0;

  // Compute month-over-month revenue growth from actual monthly buckets
  const refMonth = todayStr.slice(0, 7); // YYYY-MM
  const refDate = new Date(`${todayStr}T12:00:00`);
  refDate.setMonth(refDate.getMonth() - 1);
  const prevMonth = refDate.toISOString().slice(0, 7);

  const currentMonthRev = transactions
    .filter((t) => t.type === 'income' && t.date.startsWith(refMonth))
    .reduce((s, t) => s + t.amount, 0);
  const prevMonthRev = transactions
    .filter((t) => t.type === 'income' && t.date.startsWith(prevMonth))
    .reduce((s, t) => s + t.amount, 0);

  const revenueGrowthPct =
    prevMonthRev > 0
      ? ((currentMonthRev - prevMonthRev) / prevMonthRev) * 100
      : currentMonthRev > 0
        ? 100
        : 0;

  const openTasksCount = tasks.filter((t) => !t.completed).length;

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMarginPct,
    activeProjectsCount,
    overdueProjectsCount,
    totalCustomers,
    activeCustomersCount,
    conversionRatePct,
    revenueGrowthPct,
    openTasksCount,
  };
}

export interface TimeSeriesData {
  labels: string[];
  revenue: number[];
  expenses: number[];
  netProfit: number[];
}

export function buildPerformanceSeries(
  transactions: Transaction[],
  filter: DateRangeFilter,
  todayStr = '2026-11-20'
): TimeSeriesData {
  const scoped = filterTransactionsByRange(transactions, filter, todayStr);
  const buckets = new Map<string, { label: string; revenue: number; expenses: number }>();

  if (filter.granularity === 'daily' || filter.granularity === 'custom') {
    const sortedDates = Array.from(new Set(scoped.map((t) => t.date))).sort();
    for (const d of sortedDates) {
      buckets.set(d, { label: d.slice(5), revenue: 0, expenses: 0 });
    }
    for (const tx of scoped) {
      const b = buckets.get(tx.date);
      if (b) {
        if (tx.type === 'income') b.revenue += tx.amount;
        else b.expenses += tx.amount;
      }
    }
  } else if (filter.granularity === 'weekly') {
    for (const tx of scoped) {
      const dt = new Date(`${tx.date}T12:00:00`);
      const day = dt.getDay();
      const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(dt.setDate(diff));
      const key = weekStart.toISOString().slice(0, 10);
      if (!buckets.has(key)) {
        buckets.set(key, { label: `Wk ${key.slice(5)}`, revenue: 0, expenses: 0 });
      }
      const b = buckets.get(key)!;
      if (tx.type === 'income') b.revenue += tx.amount;
      else b.expenses += tx.amount;
    }
  } else if (filter.granularity === 'monthly') {
    const ref = new Date(`${todayStr}T12:00:00`);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      buckets.set(key, { label, revenue: 0, expenses: 0 });
    }
    for (const tx of scoped) {
      const key = tx.date.slice(0, 7);
      const b = buckets.get(key);
      if (b) {
        if (tx.type === 'income') b.revenue += tx.amount;
        else b.expenses += tx.amount;
      }
    }
  } else {
    // yearly
    for (const tx of scoped) {
      const key = tx.date.slice(0, 4);
      if (!buckets.has(key)) {
        buckets.set(key, { label: key, revenue: 0, expenses: 0 });
      }
      const b = buckets.get(key)!;
      if (tx.type === 'income') b.revenue += tx.amount;
      else b.expenses += tx.amount;
    }
  }

  const ordered = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  return {
    labels: ordered.map((o) => o.label),
    revenue: ordered.map((o) => o.revenue),
    expenses: ordered.map((o) => o.expenses),
    netProfit: ordered.map((o) => o.revenue - o.expenses),
  };
}

export interface CategoryBreakdown {
  category: string;
  income: number;
  expense: number;
}

export function buildCategoryBreakdown(transactions: Transaction[]): CategoryBreakdown[] {
  const map = new Map<string, CategoryBreakdown>();
  for (const tx of transactions) {
    const existing = map.get(tx.category) || { category: tx.category, income: 0, expense: 0 };
    if (tx.type === 'income') existing.income += tx.amount;
    else existing.expense += tx.amount;
    map.set(tx.category, existing);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.income + b.expense - (a.income + a.expense)
  );
}

export interface MonthlySummaryRow {
  month: string;
  income: number;
  expenses: number;
  net: number;
  marginPct: number;
}

export function buildMonthlyFinancialSummary(transactions: Transaction[]): MonthlySummaryRow[] {
  const map = new Map<string, { income: number; expenses: number }>();
  for (const tx of transactions) {
    const month = tx.date.slice(0, 7);
    const entry = map.get(month) || { income: 0, expenses: 0 };
    if (tx.type === 'income') entry.income += tx.amount;
    else entry.expenses += tx.amount;
    map.set(month, entry);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, data]) => {
      const net = data.income - data.expenses;
      const marginPct = data.income > 0 ? (net / data.income) * 100 : 0;
      return { month, income: data.income, expenses: data.expenses, net, marginPct };
    });
}

export interface BudgetStatusRow {
  budget: Budget;
  spentThisMonth: number;
  remaining: number;
  utilizationPct: number;
}

export function computeBudgetStatuses(
  budgets: Budget[],
  transactions: Transaction[],
  monthPrefix = '2026-11'
): BudgetStatusRow[] {
  return budgets.map((budget) => {
    const spentThisMonth = transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.category.toLowerCase() === budget.category.toLowerCase() &&
          t.date.startsWith(monthPrefix)
      )
      .reduce((sum, t) => sum + t.amount, 0);
    const remaining = budget.monthlyLimit - spentThisMonth;
    const utilizationPct =
      budget.monthlyLimit > 0 ? (spentThisMonth / budget.monthlyLimit) * 100 : 0;
    return { budget, spentThisMonth, remaining, utilizationPct };
  });
}

export function buildTransactionsCsv(transactions: Transaction[]): string {
  const headers = ['ID', 'Date', 'Type', 'Category', 'Description', 'Amount', 'Project ID'];
  const rows = transactions.map((t) => [
    escapeCsvCell(t.id),
    escapeCsvCell(t.date),
    escapeCsvCell(t.type),
    escapeCsvCell(t.category),
    escapeCsvCell(t.description),
    escapeCsvCell(t.amount.toFixed(2)),
    escapeCsvCell(t.projectId || ''),
  ]);
  return [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\n');
}
