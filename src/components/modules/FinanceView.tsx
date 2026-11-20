import React, { useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Plus,
  Printer,
  ScanLine,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { uploadReceiptToStorage } from '../../firebase';
import { ReceiptExtraction, Transaction, TransactionType } from '../../types/nexus';
import {
  buildMonthlyFinancialSummary,
  buildTransactionsCsv,
  computeBudgetStatuses,
  formatCurrencyExact,
} from '../../utils/calculations';
import { validateTransactionInput } from '../../utils/validation';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';

const CATEGORIES = [
  'Retainer & Contracts',
  'Project Milestones',
  'Consulting & Advisory',
  'Payroll & Contractors',
  'Cloud & Infrastructure',
  'Software & SaaS',
  'Marketing & Growth',
  'Office & Operations',
];

export function FinanceView() {
  const {
    transactions,
    budgets,
    projects,
    currency,
    firebaseUser,
    addTransaction,
    deleteTransaction,
    saveBudget,
    pushToast,
  } = useWorkspace();

  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  // Transaction Form
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('Cloud & Infrastructure');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState('2026-11-20');
  const [txProjectId, setTxProjectId] = useState('');
  const [txReceiptUrl, setTxReceiptUrl] = useState('');
  const [txErrors, setTxErrors] = useState<Record<string, string>>({});

  // Receipt Scanner
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptExtraction | null>(null);

  // Budget Modal
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState('Cloud & Infrastructure');
  const [budgetLimit, setBudgetLimit] = useState('5500');

  const pnl = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const net = income - expenses;
    const margin = income > 0 ? (net / income) * 100 : 0;
    return { income, expenses, net, margin };
  }, [transactions]);

  const monthlySummary = useMemo(
    () => buildMonthlyFinancialSummary(transactions),
    [transactions]
  );

  const budgetStatuses = useMemo(
    () => computeBudgetStatuses(budgets, transactions, '2026-11'),
    [budgets, transactions]
  );

  const filteredTx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((t) => (typeFilter === 'all' ? true : t.type === typeFilter))
      .filter((t) => (categoryFilter === 'all' ? true : t.category === categoryFilter))
      .filter(
        (t) =>
          !q ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.date.includes(q)
      );
  }, [transactions, typeFilter, categoryFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTx.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedTx = filteredTx.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(txAmount);
    const errors = validateTransactionInput({
      type: txType,
      amount: numericAmount,
      category: txCategory,
      description: txDescription,
      date: txDate,
      receiptUrl: txReceiptUrl,
    });
    if (Object.keys(errors).length > 0) {
      setTxErrors(errors);
      return;
    }

    await addTransaction({
      type: txType,
      amount: numericAmount,
      category: txCategory,
      description: txDescription.trim(),
      date: txDate,
      projectId: txProjectId || undefined,
      receiptUrl: txReceiptUrl || undefined,
    });
    setTxModalOpen(false);
    setTxAmount('');
    setTxDescription('');
    setTxReceiptUrl('');
  };

  const handleExportCsv = () => {
    const csv = buildTransactionsCsv(filteredTx);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast({ title: 'CSV exported', description: `${filteredTx.length} transactions exported.`, variant: 'success' });
  };

  const runImageAnalysis = async (base64: string, mimeType: string) => {
    setScanLoading(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/gemini/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          mode: 'receipt',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Receipt analysis failed.');
      setScanResult(data.extracted as ReceiptExtraction);
    } catch (err) {
      pushToast({
        title: 'Receipt analysis failed',
        description: err instanceof Error ? err.message : 'Unable to parse receipt image.',
        variant: 'error',
      });
    } finally {
      setScanLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      pushToast({ title: 'Unsupported file', description: 'Upload PNG, JPEG, or WebP.', variant: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      setScanPreview(dataUrl);
      const base64 = dataUrl.split(',')[1];
      if (firebaseUser) {
        try {
          const url = await uploadReceiptToStorage(firebaseUser.uid, file);
          setTxReceiptUrl(url);
        } catch (err) {
          console.warn('Firebase Storage receipt upload skipped:', err);
        }
      }
      await runImageAnalysis(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSampleReceipt = async () => {
    const sampleUrl = '/src/assets/images/sample_invoice_receipt_1795216108878.jpg';
    setScanPreview(sampleUrl);
    setScanLoading(true);
    try {
      const resp = await fetch(sampleUrl);
      const blob = await resp.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      await runImageAnalysis(base64, blob.type || 'image/jpeg');
    } catch (err) {
      setScanLoading(false);
      pushToast({ title: 'Unable to load sample invoice', variant: 'error' });
    }
  };

  const applyScannedExpense = () => {
    if (!scanResult) return;
    setTxType('expense');
    setTxAmount(String(scanResult.totalAmount || ''));
    setTxCategory(
      CATEGORIES.includes(scanResult.category) ? scanResult.category : 'Cloud & Infrastructure'
    );
    setTxDescription(`${scanResult.vendor}: ${scanResult.description}`.slice(0, 240));
    setTxDate(scanResult.date || '2026-11-20');
    setScannerOpen(false);
    setTxModalOpen(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = Number(budgetLimit);
    if (Number.isNaN(limit) || limit < 0) return;
    const existing = budgets.find((b) => b.category === budgetCategory);
    await saveBudget({
      id: existing?.id,
      category: budgetCategory,
      monthlyLimit: limit,
    });
    setBudgetModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Accurate P&L Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Cumulative Gross Income</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrencyExact(pnl.income, currency)}
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Cumulative Expenses</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {formatCurrencyExact(pnl.expenses, currency)}
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Net Profit & Loss</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatCurrencyExact(pnl.net, currency)}
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Operating Profit Margin</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
            {pnl.margin.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 rounded-lg bg-slate-200/70 dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
            {(['all', 'income', 'expense'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTypeFilter(t);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  typeFilter === t
                    ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div className="relative w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search ledger..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-cyan-600/10 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/20 whitespace-nowrap"
          >
            <ScanLine className="w-3.5 h-3.5" />
            Scan Receipt (AI)
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#232838] bg-white dark:bg-[#131620] hover:bg-slate-50 dark:hover:bg-white/5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#232838] bg-white dark:bg-[#131620] hover:bg-slate-50 dark:hover:bg-white/5 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Printable Report
          </button>
          <button
            type="button"
            onClick={() => setTxModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Entry
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      {pagedTx.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet className="w-5 h-5" />}
          title="No transactions match"
          description="Record an income or expense entry, or scan an invoice image to populate your financial ledger."
          actionLabel="Record Entry"
          onAction={() => setTxModalOpen(true)}
        />
      ) : (
        <div className="rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#232838] text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#232838] text-xs">
                {pagedTx.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {tx.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{tx.category}</td>
                    <td className="py-3 px-4 capitalize">
                      <span
                        className={
                          tx.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-rose-600 dark:text-rose-400 font-medium'
                        }
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {tx.type === 'income' ? '+' : '-'}
                      {formatCurrencyExact(tx.amount, currency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(tx)}
                        aria-label={`Delete ${tx.description}`}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-[#232838] text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              Page {safePage} of {totalPages} ({filteredTx.length} entries)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-slate-200 dark:border-[#232838] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-slate-200 dark:border-[#232838] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly P&L Summaries & Category Budgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Monthly Financial Summaries
          </h3>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#232838] text-[11px] text-slate-500">
                  <th className="py-2">Month</th>
                  <th className="py-2 text-right">Income</th>
                  <th className="py-2 text-right">Expenses</th>
                  <th className="py-2 text-right">Net P&L</th>
                  <th className="py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#232838] font-mono tabular-nums">
                {monthlySummary.map((row) => (
                  <tr key={row.month}>
                    <td className="py-2 text-slate-700 dark:text-slate-300">{row.month}</td>
                    <td className="py-2 text-right text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyExact(row.income, currency)}
                    </td>
                    <td className="py-2 text-right text-rose-600 dark:text-rose-400">
                      {formatCurrencyExact(row.expenses, currency)}
                    </td>
                    <td className="py-2 text-right font-semibold">
                      {formatCurrencyExact(row.net, currency)}
                    </td>
                    <td className="py-2 text-right text-slate-500">{row.marginPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                November Category Budget Tracking
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Current month spend vs monthly allocation
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBudgetModalOpen(true)}
              className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              Adjust Budget
            </button>
          </div>
          <div className="space-y-3.5">
            {budgetStatuses.map(({ budget, spentThisMonth, utilizationPct }) => {
              const over = utilizationPct > 100;
              return (
                <div key={budget.id} className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {budget.category}
                    </span>
                    <span
                      className={`font-mono tabular-nums ${
                        over ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500'
                      }`}
                    >
                      {formatCurrencyExact(spentThisMonth, currency)} /{' '}
                      {formatCurrencyExact(budget.monthlyLimit, currency)} ({utilizationPct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        over
                          ? 'bg-rose-500'
                          : utilizationPct > 80
                            ? 'bg-amber-500'
                            : 'bg-cyan-500'
                      }`}
                      style={{ width: `${Math.min(100, utilizationPct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Transaction Modal */}
      <Modal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        title="Record Financial Transaction"
      >
        <form onSubmit={handleSaveTx} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Type</label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value as TransactionType)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
              {txErrors.amount && <p className="text-xs text-rose-500 mt-1">{txErrors.amount}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select
                value={txCategory}
                onChange={(e) => setTxCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Date</label>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Description</label>
              <input
                type="text"
                value={txDescription}
                onChange={(e) => setTxDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
              {txErrors.description && (
                <p className="text-xs text-rose-500 mt-1">{txErrors.description}</p>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Linked Project (optional)</label>
              <select
                value={txProjectId}
                onChange={(e) => setTxProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setTxModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-[#232838]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white"
            >
              Save Transaction
            </button>
          </div>
        </form>
      </Modal>

      {/* AI Receipt Scanner Modal */}
      <Modal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="AI Receipt & Invoice Scanner"
        subtitle="Upload an invoice photo or test with the sample document to extract structured ledger fields"
        maxWidth="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-300 dark:border-[#232838] rounded-xl cursor-pointer hover:border-violet-500/60 transition-colors text-center">
              <Upload className="w-5 h-5 text-violet-500 mb-2" />
              <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                Upload Receipt or Invoice (PNG/JPG/WebP)
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>

            <button
              type="button"
              onClick={handleLoadSampleReceipt}
              className="w-full py-2 px-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#232838] hover:bg-slate-50 dark:hover:bg-white/5"
            >
              Test with Sample CloudScale Invoice
            </button>

            {scanPreview && (
              <img
                src={scanPreview}
                alt="Uploaded invoice preview"
                referrerPolicy="no-referrer"
                className="w-full h-56 object-contain rounded-lg bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
            )}
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Extracted Ledger Fields
            </h4>
            {scanLoading ? (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838] text-xs text-slate-500 animate-pulse">
                Analyzing document with Gemini Vision...
              </div>
            ) : scanResult ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838] space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Vendor</span>
                  <span className="font-semibold">{scanResult.vendor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {scanResult.currency} {scanResult.totalAmount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date</span>
                  <span className="font-mono">{scanResult.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Category</span>
                  <span>{scanResult.category}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-[#232838]">
                  {scanResult.description}
                </p>
                {Array.isArray(scanResult.lineItems) && scanResult.lineItems.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-500">
                    {scanResult.lineItems.map((li, i) => (
                      <li key={i}>{li}</li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={applyScannedExpense}
                  className="w-full mt-3 py-2 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium"
                >
                  Create Expense From Scan
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload an invoice photo or load the sample receipt to extract vendor, total amount,
                line items, and expense category automatically.
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* Budget Modal */}
      <Modal
        open={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        title="Configure Category Budget"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveBudget} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Category</label>
            <select
              value={budgetCategory}
              onChange={(e) => setBudgetCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Monthly Limit</label>
            <input
              type="number"
              min="0"
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setBudgetModalOpen(false)}
              className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#232838]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white"
            >
              Save Budget
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Financial Report Modal */}
      <Modal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="NEXUS Financial P&L Statement"
        maxWidth="xl"
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between no-print">
            <p className="text-xs text-slate-500">
              Formatted summary ready for PDF export or physical printing.
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 p-4 rounded-lg border border-slate-200 dark:border-[#232838] text-xs font-mono">
            <div>
              <span className="text-slate-500 block">Gross Income</span>
              <span className="text-base font-bold">{formatCurrencyExact(pnl.income, currency)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Total Expenses</span>
              <span className="text-base font-bold">{formatCurrencyExact(pnl.expenses, currency)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Net Profit</span>
              <span className="text-base font-bold">{formatCurrencyExact(pnl.net, currency)}</span>
            </div>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#232838]">
                <th className="py-2">Month</th>
                <th className="py-2 text-right">Income</th>
                <th className="py-2 text-right">Expenses</th>
                <th className="py-2 text-right">Net P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#232838] font-mono">
              {monthlySummary.map((r) => (
                <tr key={r.month}>
                  <td className="py-2">{r.month}</td>
                  <td className="py-2 text-right">{formatCurrencyExact(r.income, currency)}</td>
                  <td className="py-2 text-right">{formatCurrencyExact(r.expenses, currency)}</td>
                  <td className="py-2 text-right font-semibold">{formatCurrencyExact(r.net, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteTransaction(deleteTarget.id);
        }}
        title="Delete Ledger Entry"
        message={`Remove "${deleteTarget?.description}" from the financial ledger?`}
        confirmLabel="Delete Entry"
      />
    </div>
  );
}
