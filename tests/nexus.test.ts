import assert from 'node:assert/strict';
import { createDemoDataset } from '../src/data/demoData';
import {
  buildMonthlyFinancialSummary,
  buildPerformanceSeries,
  buildTransactionsCsv,
  computeBudgetStatuses,
  computeDashboardMetrics,
} from '../src/utils/calculations';
import {
  escapeCsvCell,
  validateCustomerInput,
  validateProjectInput,
  validateTransactionInput,
} from '../src/utils/validation';

const dataset = createDemoDataset('test_user');

// 1. Financial Totals & P&L Accuracy
const monthlyMetrics = computeDashboardMetrics(
  dataset.transactions,
  dataset.projects,
  dataset.customers,
  dataset.tasks,
  { granularity: 'monthly', startDate: '2026-01-01', endDate: '2026-11-20' }
);

assert.ok(monthlyMetrics.totalRevenue > 0, 'Total revenue should be positive');
assert.ok(monthlyMetrics.totalExpenses > 0, 'Total expenses should be positive');
assert.equal(
  monthlyMetrics.netProfit,
  monthlyMetrics.totalRevenue - monthlyMetrics.totalExpenses,
  'Net profit must equal revenue minus expenses'
);
assert.equal(monthlyMetrics.overdueProjectsCount, 1, 'Demo dataset has 1 overdue project');

// 2. Time Series Aggregation
const series = buildPerformanceSeries(dataset.transactions, {
  granularity: 'monthly',
  startDate: '2026-01-01',
  endDate: '2026-11-20',
});
assert.equal(series.labels.length, 12, 'Monthly series should return 12 buckets');
assert.equal(series.netProfit[0], series.revenue[0] - series.expenses[0]);

// 3. Monthly P&L & Budgets
const summaryRows = buildMonthlyFinancialSummary(dataset.transactions);
assert.ok(summaryRows.length >= 12, 'Should aggregate all months');
const budgetRows = computeBudgetStatuses(dataset.budgets, dataset.transactions, '2026-11');
assert.equal(budgetRows.length, dataset.budgets.length);

// 4. CSV Injection Escaping & Export
assert.equal(escapeCsvCell('=SUM(A1:A2)'), `"'=SUM(A1:A2)"`);
const csv = buildTransactionsCsv(dataset.transactions.slice(0, 3));
assert.ok(csv.includes('"ID","Date","Type"'), 'CSV header must be present');

// 5. Validation Rules
const badCustomer = validateCustomerInput({
  name: '',
  company: 'Acme',
  email: 'invalid-email',
  segment: 'lead',
  value: -50,
  source: 'Web',
});
assert.ok(badCustomer.name && badCustomer.email && badCustomer.value);

const badProject = validateProjectInput({
  title: '',
  clientName: '',
  status: 'active',
  budget: -1,
  spent: 0,
  progress: 120,
  deadline: '',
  members: [],
});
assert.ok(badProject.title && badProject.clientName && badProject.budget && badProject.progress);

const badTx = validateTransactionInput({
  type: 'expense',
  amount: 0,
  category: 'Software & SaaS',
  description: 'Test',
  date: '2026-11-20',
  receiptUrl: 'javascript:alert(1)',
});
assert.ok(badTx.amount && badTx.receiptUrl);

console.log('All NEXUS calculation, CSV escaping, and validation tests passed.');
