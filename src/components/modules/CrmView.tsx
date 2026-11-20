import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Edit3,
  Mail,
  MessageSquarePlus,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Customer, CustomerSegment, InteractionChannel } from '../../types/nexus';
import { formatCurrency } from '../../utils/calculations';
import { validateCustomerInput } from '../../utils/validation';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';

type SortField = 'name' | 'company' | 'segment' | 'value' | 'source';

export function CrmView() {
  const {
    customers,
    interactions,
    currency,
    saveCustomer,
    deleteCustomer,
    addCustomerInteraction,
  } = useWorkspace();

  const [segmentFilter, setSegmentFilter] = useState<'all' | CustomerSegment>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [segment, setSegment] = useState<CustomerSegment>('lead');
  const [value, setValue] = useState('15000');
  const [source, setSource] = useState('Inbound Search');
  const [notes, setNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Interaction Log State
  const [intChannel, setIntChannel] = useState<InteractionChannel>('call');
  const [intSummary, setIntSummary] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => (segmentFilter === 'all' ? true : c.segment === segmentFilter))
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.source.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const dir = sortAsc ? 1 : -1;
        if (sortField === 'value') return (a.value - b.value) * dir;
        return String(a[sortField]).localeCompare(String(b[sortField])) * dir;
      });
  }, [customers, segmentFilter, search, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const openCreateModal = () => {
    setEditing(null);
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setSegment('lead');
    setValue('15000');
    setSource('Inbound Search');
    setNotes('');
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditing(c);
    setName(c.name);
    setCompany(c.company);
    setEmail(c.email);
    setPhone(c.phone || '');
    setSegment(c.segment);
    setValue(String(c.value));
    setSource(c.source);
    setNotes(c.notes || '');
    setFormErrors({});
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericVal = Number(value);
    const errors = validateCustomerInput({
      name,
      company,
      email,
      phone,
      segment,
      value: numericVal,
      source,
      notes,
    });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    await saveCustomer({
      id: editing?.id,
      name: name.trim(),
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      segment,
      value: numericVal,
      source: source.trim(),
      notes: notes.trim(),
    });
    setFormOpen(false);
    if (selectedCustomer && editing && selectedCustomer.id === editing.id) {
      setSelectedCustomer({
        ...editing,
        name: name.trim(),
        company: company.trim(),
        email: email.trim(),
        phone: phone.trim(),
        segment,
        value: numericVal,
        source: source.trim(),
        notes: notes.trim(),
      });
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !intSummary.trim()) return;
    await addCustomerInteraction({
      customerId: selectedCustomer.id,
      channel: intChannel,
      summary: intSummary.trim(),
      date: new Date().toISOString().slice(0, 10),
    });
    setIntSummary('');
  };

  const customerInteractions = selectedCustomer
    ? interactions.filter((i) => i.customerId === selectedCustomer.id)
    : [];

  return (
    <div className="space-y-5">
      {/* Segment Tabs + Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
          {(['all', 'lead', 'prospect', 'active', 'inactive'] as const).map((seg) => {
            const count =
              seg === 'all'
                ? customers.length
                : customers.filter((c) => c.segment === seg).length;
            return (
              <button
                key={seg}
                type="button"
                onClick={() => {
                  setSegmentFilter(seg);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  segmentFilter === seg
                    ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {seg} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Filter customers..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-violet-500"
            />
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white whitespace-nowrap shrink-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Table */}
      {paged.length === 0 ? (
        <EmptyState
          icon={<Users className="w-5 h-5" />}
          title="No customers found"
          description="Try clearing your search filter or add a new account to your CRM pipeline."
          actionLabel="Add Customer"
          onAction={openCreateModal}
        />
      ) : (
        <div className="rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#232838] text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      Customer <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('company')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      Company <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('segment')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      Segment <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('source')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      Source <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('value')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      Account Value <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#232838] text-xs">
                {paged.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{c.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.email}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{c.company}</td>
                    <td className="py-3 px-4 capitalize">
                      <span
                        className={`font-medium ${
                          c.segment === 'active'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : c.segment === 'prospect'
                              ? 'text-violet-600 dark:text-violet-400'
                              : c.segment === 'lead'
                                ? 'text-cyan-600 dark:text-cyan-400'
                                : 'text-slate-500'
                        }`}
                      >
                        {c.segment}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{c.source}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(c.value, currency)}
                    </td>
                    <td
                      className="py-3 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          aria-label={`Edit ${c.name}`}
                          className="p-1.5 rounded-md text-slate-500 hover:text-violet-600 hover:bg-violet-500/10"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          aria-label={`Delete ${c.name}`}
                          className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-[#232838] text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of{' '}
              {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-slate-200 dark:border-[#232838] disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Previous
              </button>
              <span className="font-mono tabular-nums">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-slate-200 dark:border-[#232838] disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Profile Slide-Over */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/50">
          <div className="w-full max-w-md bg-white dark:bg-[#131620] border-l border-slate-200 dark:border-[#232838] h-full flex flex-col overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-[#232838]">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {selectedCustomer.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedCustomer.company} · {selectedCustomer.segment}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                aria-label="Close customer profile"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Account Value</span>
                  <p className="font-mono font-semibold text-base text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                    {formatCurrency(selectedCustomer.value, currency)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Acquisition Source</span>
                  <p className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedCustomer.source}
                  </p>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {selectedCustomer.email}
                  </div>
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {selectedCustomer.phone}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">Notes</h4>
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedCustomer)}
                    className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Edit Profile
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed p-3 rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]">
                  {selectedCustomer.notes || 'No notes recorded yet.'}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Contact History
                </h4>
                <form onSubmit={handleAddInteraction} className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <select
                      value={intChannel}
                      onChange={(e) => setIntChannel(e.target.value as InteractionChannel)}
                      className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
                    >
                      <option value="call">Call</option>
                      <option value="email">Email</option>
                      <option value="meeting">Meeting</option>
                      <option value="note">Note</option>
                    </select>
                    <input
                      type="text"
                      value={intSummary}
                      onChange={(e) => setIntSummary(e.target.value)}
                      placeholder="Log touchpoint summary..."
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
                    />
                    <button
                      type="submit"
                      className="p-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white"
                      aria-label="Log interaction"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                    </button>
                  </div>
                </form>

                <div className="space-y-2.5">
                  {customerInteractions.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No touchpoints logged for this customer.
                    </p>
                  ) : (
                    customerInteractions.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838] text-xs"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span className="capitalize font-medium text-cyan-600 dark:text-cyan-400">
                            {item.channel}
                          </span>
                          <span className="font-mono">{item.date}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-200">{item.summary}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add New Customer'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium mb-1">Contact Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
              {formErrors.name && <p className="text-xs text-rose-500 mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
              {formErrors.company && (
                <p className="text-xs text-rose-500 mt-1">{formErrors.company}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
              {formErrors.email && <p className="text-xs text-rose-500 mt-1">{formErrors.email}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Segment</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value as CustomerSegment)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              >
                <option value="lead">Lead</option>
                <option value="prospect">Prospect</option>
                <option value="active">Active Customer</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Contract Value</label>
              <input
                type="number"
                min="0"
                step="100"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
              {formErrors.value && <p className="text-xs text-rose-500 mt-1">{formErrors.value}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Acquisition Source</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
              {formErrors.source && (
                <p className="text-xs text-rose-500 mt-1">{formErrors.source}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Account Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-[#232838]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white"
            >
              {editing ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteCustomer(deleteTarget.id);
            if (selectedCustomer?.id === deleteTarget.id) setSelectedCustomer(null);
          }
        }}
        title="Delete Customer"
        message={`Are you sure you want to remove ${deleteTarget?.name} (${deleteTarget?.company}) from your CRM? This action cannot be undone.`}
        confirmLabel="Delete Customer"
      />
    </div>
  );
}
