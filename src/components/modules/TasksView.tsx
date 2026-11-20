import React, { useMemo, useState } from 'react';
import { CheckCircle2, CheckSquare, Circle, Plus, Search, Trash2 } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { TaskItem, TaskPriority, TaskStage } from '../../types/nexus';
import { validateTaskInput } from '../../utils/validation';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';

export function TasksView() {
  const { tasks, projects, saveTask, deleteTask } = useWorkspace();

  const [statusTab, setStatusTab] = useState<'open' | 'completed' | 'all'>('open');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('Alex Rivera');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [stage, setStage] = useState<TaskStage>('backlog');
  const [dueDate, setDueDate] = useState('2026-11-28');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks
      .filter((t) =>
        statusTab === 'open' ? !t.completed : statusTab === 'completed' ? t.completed : true
      )
      .filter((t) => (priorityFilter === 'all' ? true : t.priority === priorityFilter))
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          t.assignee.toLowerCase().includes(q)
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, statusTab, priorityFilter, search]);

  const handleToggle = async (t: TaskItem) => {
    const nextDone = !t.completed;
    await saveTask({
      ...t,
      completed: nextDone,
      stage: nextDone ? 'done' : t.stage === 'done' ? 'in_progress' : t.stage,
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProj = projectId || projects[0]?.id || '';
    const input = { projectId: targetProj, title: title.trim(), assignee: assignee.trim(), priority, stage, dueDate };
    const errs = validateTaskInput(input);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    await saveTask({
      ...input,
      completed: stage === 'done',
    });
    setModalOpen(false);
    setTitle('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 rounded-lg bg-slate-200/70 dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
            {(['open', 'completed', 'all'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  statusTab === tab
                    ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'all' | TaskPriority)}
            className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tasks..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]"
            />
          </div>
          <button
            type="button"
            disabled={projects.length === 0}
            onClick={() => {
              setProjectId(projects[0]?.id || '');
              setErrors({});
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Task
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="w-5 h-5" />}
          title="No tasks in this view"
          description={
            projects.length === 0
              ? 'Create a project first, then add tasks to track deliverables.'
              : 'All tasks in this filter are cleared or none match your search.'
          }
          actionLabel={projects.length > 0 ? 'Create Task' : undefined}
          onAction={projects.length > 0 ? () => setModalOpen(true) : undefined}
        />
      ) : (
        <div className="rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] divide-y divide-slate-100 dark:divide-[#232838]">
          {filtered.map((task) => {
            const proj = projects.find((p) => p.id === task.projectId);
            const overdue = !task.completed && task.dueDate < '2026-11-20';
            return (
              <div
                key={task.id}
                className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(task)}
                    aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}
                    className="mt-0.5 shrink-0"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 hover:text-violet-500" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        task.completed
                          ? 'line-through text-slate-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {task.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {proj?.title || 'Project'} · Assigned to {task.assignee} ·{' '}
                      <span className="capitalize">{task.stage.replace('_', ' ')}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs shrink-0 pl-7 sm:pl-0">
                  <span
                    className={`capitalize font-medium ${
                      task.priority === 'critical'
                        ? 'text-rose-600 dark:text-rose-400'
                        : task.priority === 'high'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500'
                    }`}
                  >
                    {task.priority}
                  </span>
                  <span
                    className={`font-mono tabular-nums ${
                      overdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {task.dueDate}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteTask(task.projectId, task.id)}
                    aria-label={`Delete ${task.title}`}
                    className="p-1.5 rounded text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Task" maxWidth="sm">
        <form onSubmit={handleCreate} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
            />
            {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Assignee</label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as TaskStage)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              >
                <option value="backlog">Backlog</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#232838]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white"
            >
              Save Task
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
