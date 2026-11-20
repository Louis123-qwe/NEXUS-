import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Circle,
  Edit3,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Project, ProjectStatus, TaskItem, TaskPriority, TaskStage } from '../../types/nexus';
import { formatCurrency } from '../../utils/calculations';
import { validateProjectInput, validateTaskInput } from '../../utils/validation';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';

const TODAY_REF = '2026-11-20';

const STAGES: Array<{ id: TaskStage; label: string }> = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

export function ProjectsView() {
  const {
    projects,
    tasks,
    comments,
    currency,
    saveProject,
    deleteProject,
    saveTask,
    deleteTask,
    addProjectComment,
  } = useWorkspace();

  const [viewMode, setViewMode] = useState<'portfolio' | 'kanban'>('portfolio');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [search, setSearch] = useState('');
  const [kanbanProjectFilter, setKanbanProjectFilter] = useState<string>('all');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<TaskStage | null>(null);

  // Modals
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  // Project Form
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [budget, setBudget] = useState('25000');
  const [spent, setSpent] = useState('0');
  const [progress, setProgress] = useState('15');
  const [deadline, setDeadline] = useState('2026-12-15');
  const [membersCsv, setMembersCsv] = useState('Alex Rivera, Maya Lin');
  const [projErrors, setProjErrors] = useState<Record<string, string>>({});

  // Task Form
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('Alex Rivera');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskStage, setTaskStage] = useState<TaskStage>('backlog');
  const [taskDueDate, setTaskDueDate] = useState('2026-11-28');
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});

  // Comment Input
  const [commentText, setCommentText] = useState('');

  const overdueProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed' && p.deadline < TODAY_REF),
    [projects]
  );

  const upcomingProjects = useMemo(() => {
    const plus10 = '2026-11-30';
    return projects.filter(
      (p) => p.status !== 'completed' && p.deadline >= TODAY_REF && p.deadline <= plus10
    );
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects
      .filter((p) => (statusFilter === 'all' ? true : p.status === statusFilter))
      .filter(
        (p) =>
          !q ||
          p.title.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q) ||
          p.members.some((m) => m.toLowerCase().includes(q))
      );
  }, [projects, statusFilter, search]);

  const scopedTasks = useMemo(() => {
    return tasks.filter((t) =>
      kanbanProjectFilter === 'all' ? true : t.projectId === kanbanProjectFilter
    );
  }, [tasks, kanbanProjectFilter]);

  const openCreateProject = () => {
    setEditingProject(null);
    setTitle('');
    setClientName('');
    setStatus('active');
    setBudget('25000');
    setSpent('0');
    setProgress('10');
    setDeadline('2026-12-15');
    setMembersCsv('Alex Rivera, Maya Lin');
    setProjErrors({});
    setProjectModalOpen(true);
  };

  const openEditProject = (p: Project) => {
    setEditingProject(p);
    setTitle(p.title);
    setClientName(p.clientName);
    setStatus(p.status);
    setBudget(String(p.budget));
    setSpent(String(p.spent));
    setProgress(String(p.progress));
    setDeadline(p.deadline);
    setMembersCsv(p.members.join(', '));
    setProjErrors({});
    setProjectModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const members = membersCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    const input = {
      title: title.trim(),
      clientName: clientName.trim(),
      status,
      budget: Number(budget),
      spent: Number(spent),
      progress: Number(progress),
      deadline,
      members,
    };
    const errors = validateProjectInput(input);
    if (Object.keys(errors).length > 0) {
      setProjErrors(errors);
      return;
    }

    await saveProject({
      id: editingProject?.id,
      ...input,
    });
    setProjectModalOpen(false);
  };

  const openCreateTask = (defaultProjId?: string, defaultStage: TaskStage = 'backlog') => {
    setTaskProjectId(defaultProjId || projects[0]?.id || '');
    setTaskTitle('');
    setTaskAssignee('Alex Rivera');
    setTaskPriority('medium');
    setTaskStage(defaultStage);
    setTaskDueDate('2026-11-28');
    setTaskErrors({});
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      projectId: taskProjectId,
      title: taskTitle.trim(),
      assignee: taskAssignee.trim(),
      priority: taskPriority,
      stage: taskStage,
      dueDate: taskDueDate,
    };
    const errors = validateTaskInput(input);
    if (Object.keys(errors).length > 0) {
      setTaskErrors(errors);
      return;
    }

    await saveTask({
      ...input,
      completed: taskStage === 'done',
    });
    setTaskModalOpen(false);
  };

  const handleDropTask = async (targetStage: TaskStage) => {
    setDragOverStage(null);
    if (!draggedTaskId) return;
    const task = tasks.find((t) => t.id === draggedTaskId);
    setDraggedTaskId(null);
    if (!task || task.stage === targetStage) return;
    await saveTask({
      ...task,
      stage: targetStage,
      completed: targetStage === 'done',
    });
  };

  const handleMoveStage = async (task: TaskItem, stage: TaskStage) => {
    await saveTask({
      ...task,
      stage,
      completed: stage === 'done',
    });
  };

  const handleToggleTask = async (task: TaskItem) => {
    const nextDone = !task.completed;
    await saveTask({
      ...task,
      completed: nextDone,
      stage: nextDone ? 'done' : task.stage === 'done' ? 'in_progress' : task.stage,
    });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailProject || !commentText.trim()) return;
    await addProjectComment(detailProject.id, commentText.trim());
    setCommentText('');
  };

  return (
    <div className="space-y-6">
      {/* Deadlines Alert Strip */}
      {(overdueProjects.length > 0 || upcomingProjects.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Overdue Projects ({overdueProjects.length})
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {overdueProjects.length > 0
                  ? overdueProjects.map((p) => `${p.title} (${p.deadline})`).join(' · ')
                  : 'No overdue projects.'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] flex items-start gap-3">
            <CalendarClock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Upcoming Deadlines ({upcomingProjects.length})
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {upcomingProjects.length > 0
                  ? upcomingProjects.map((p) => `${p.title} (${p.deadline})`).join(' · ')
                  : 'No deadlines in the next 10 days.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex p-1 rounded-lg bg-slate-200/70 dark:bg-[#131620] border border-slate-200 dark:border-[#232838]">
            <button
              type="button"
              onClick={() => setViewMode('portfolio')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'portfolio'
                  ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Portfolio ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Kanban Board ({tasks.length})
            </button>
          </div>

          {viewMode === 'portfolio' ? (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | ProjectStatus)}
              className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]"
            >
              <option value="all">All Statuses</option>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          ) : (
            <select
              value={kanbanProjectFilter}
              onChange={(e) => setKanbanProjectFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-3">
          {viewMode === 'portfolio' && (
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838]"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => openCreateTask()}
            disabled={projects.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#232838] bg-white dark:bg-[#131620] hover:border-violet-500/50 disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
          </button>
          <button
            type="button"
            onClick={openCreateProject}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
        </div>
      </div>

      {/* Portfolio Grid vs Kanban */}
      {viewMode === 'portfolio' ? (
        filteredProjects.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="w-5 h-5" />}
            title="No projects match this filter"
            description="Create a new operational project to track budgets, milestones, and team tasks."
            actionLabel="New Project"
            onAction={openCreateProject}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProjects.map((p) => {
              const isOverdue = p.status !== 'completed' && p.deadline < TODAY_REF;
              const projTasks = tasks.filter((t) => t.projectId === p.id);
              const budgetPct = p.budget > 0 ? Math.min(100, Math.round((p.spent / p.budget) * 100)) : 0;

              return (
                <div
                  key={p.id}
                  onClick={() => setDetailProject(p)}
                  className="cursor-pointer p-5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] hover:border-violet-500/50 transition-colors flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {p.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {p.clientName} · <span className="capitalize">{p.status.replace('_', ' ')}</span>
                        </p>
                      </div>
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => openEditProject(p)}
                          aria-label={`Edit ${p.title}`}
                          className="p-1.5 rounded text-slate-400 hover:text-violet-500"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          aria-label={`Delete ${p.title}`}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500 dark:text-slate-400">Progress</span>
                        <span className="font-mono tabular-nums font-medium">{p.progress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-violet-600 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-[#232838] text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Budget Utilization</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(p.spent, currency)} / {formatCurrency(p.budget, currency)} ({budgetPct}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        {projTasks.length} tasks · {p.members.length} members
                      </span>
                      <span
                        className={`font-mono ${
                          isOverdue
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Due {p.deadline}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Interactive Drag-and-Drop Kanban Board */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STAGES.map((stage) => {
            const stageTasks = scopedTasks.filter((t) => t.stage === stage.id);
            const isOver = dragOverStage === stage.id;
            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStage(stage.id);
                }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={() => handleDropTask(stage.id)}
                className={`rounded-xl p-3.5 border min-h-[380px] flex flex-col gap-3 transition-colors ${
                  isOver
                    ? 'bg-violet-500/10 border-violet-500'
                    : 'bg-slate-100/70 dark:bg-[#10131C] border-slate-200 dark:border-[#232838]'
                }`}
              >
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {stage.label}
                  </h3>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {stageTasks.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1">
                  {stageTasks.map((task) => {
                    const proj = projects.find((p) => p.id === task.projectId);
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => setDraggedTaskId(task.id)}
                        className="p-3.5 rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] cursor-grab active:cursor-grabbing space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(task)}
                            className="flex items-start gap-2 text-left min-w-0"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            )}
                            <span
                              className={`text-xs font-medium leading-snug ${
                                task.completed
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {task.title}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTask(task.projectId, task.id)}
                            aria-label="Delete task"
                            className="text-slate-400 hover:text-rose-500 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {proj?.title || 'Project'} · {task.assignee}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                          <span
                            className={`capitalize font-medium ${
                              task.priority === 'critical'
                                ? 'text-rose-600 dark:text-rose-400'
                                : task.priority === 'high'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-500'
                            }`}
                          >
                            {task.priority} · {task.dueDate}
                          </span>
                          <select
                            aria-label={`Move ${task.title} stage`}
                            value={task.stage}
                            onChange={(e) => handleMoveStage(task, e.target.value as TaskStage)}
                            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838] text-[11px]"
                          >
                            {STAGES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => openCreateTask(kanbanProjectFilter === 'all' ? undefined : kanbanProjectFilter, stage.id)}
                  className="w-full py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-white/5 transition-colors"
                >
                  + Add to {stage.label}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Detail Modal with Tasks & Comments */}
      <Modal
        open={Boolean(detailProject)}
        onClose={() => setDetailProject(null)}
        title={detailProject?.title || ''}
        subtitle={
          detailProject
            ? `${detailProject.clientName} · Assigned: ${detailProject.members.join(', ')}`
            : undefined
        }
        maxWidth="lg"
      >
        {detailProject && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-xs p-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]">
              <div>
                <span className="text-slate-500">Status</span>
                <p className="font-medium capitalize mt-0.5">{detailProject.status.replace('_', ' ')}</p>
              </div>
              <div>
                <span className="text-slate-500">Deadline</span>
                <p className="font-mono mt-0.5">{detailProject.deadline}</p>
              </div>
              <div>
                <span className="text-slate-500">Spent / Budget</span>
                <p className="font-mono mt-0.5 tabular-nums">
                  {formatCurrency(detailProject.spent, currency)} /{' '}
                  {formatCurrency(detailProject.budget, currency)}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold">Project Tasks</h4>
                <button
                  type="button"
                  onClick={() => openCreateTask(detailProject.id)}
                  className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                >
                  + Add Task
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-[#232838] border border-slate-200 dark:border-[#232838] rounded-lg">
                {tasks
                  .filter((t) => t.projectId === detailProject.id)
                  .map((t) => (
                    <div key={t.id} className="px-3 py-2.5 flex items-center justify-between gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(t)}
                        className="flex items-center gap-2 text-left min-w-0"
                      >
                        {t.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className={t.completed ? 'line-through text-slate-400 truncate' : 'truncate'}>
                          {t.title}
                        </span>
                      </button>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                        {t.assignee} · {t.dueDate}
                      </span>
                    </div>
                  ))}
                {tasks.filter((t) => t.projectId === detailProject.id).length === 0 && (
                  <p className="p-4 text-xs text-slate-500 text-center">No tasks assigned yet.</p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-3.5 h-3.5" />
                Team Discussion
              </h4>
              <div className="space-y-2 mb-3 max-h-44 overflow-y-auto">
                {comments
                  .filter((c) => c.projectId === detailProject.id)
                  .map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838] text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {c.authorName}
                        </span>
                        <span className="font-mono">{String(c.createdAt).slice(0, 10)}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{c.body}</p>
                    </div>
                  ))}
              </div>
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write an update or comment..."
                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white"
                >
                  Post
                </button>
              </form>
            </div>
          </div>
        )}
      </Modal>

      {/* Create / Edit Project Modal */}
      <Modal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        title={editingProject ? `Edit ${editingProject.title}` : 'Create New Project'}
      >
        <form onSubmit={handleSaveProject} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Project Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
              {projErrors.title && <p className="text-xs text-rose-500 mt-1">{projErrors.title}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Client</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
              {projErrors.clientName && (
                <p className="text-xs text-rose-500 mt-1">{projErrors.clientName}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Budget</label>
              <input
                type="number"
                min="0"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Spent to Date</label>
              <input
                type="number"
                min="0"
                value={spent}
                onChange={(e) => setSpent(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Progress (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Team Members (comma separated)</label>
              <input
                type="text"
                value={membersCsv}
                onChange={(e) => setMembersCsv(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setProjectModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-[#232838]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white"
            >
              {editingProject ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Task Modal */}
      <Modal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title="Add Task"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveTask} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium mb-1">Project</label>
            <select
              value={taskProjectId}
              onChange={(e) => setTaskProjectId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            {taskErrors.projectId && (
              <p className="text-xs text-rose-500 mt-1">{taskErrors.projectId}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Task Title</label>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
            />
            {taskErrors.title && <p className="text-xs text-rose-500 mt-1">{taskErrors.title}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Assignee</label>
              <input
                type="text"
                value={taskAssignee}
                onChange={(e) => setTaskAssignee(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Due Date</label>
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Priority</label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
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
                value={taskStage}
                onChange={(e) => setTaskStage(e.target.value as TaskStage)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#232838]"
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setTaskModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-[#232838]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white"
            >
              Create Task
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteProject(deleteTarget.id);
        }}
        title="Delete Project"
        message={`Delete "${deleteTarget?.title}" and its associated tasks? This action cannot be undone.`}
        confirmLabel="Delete Project"
      />
    </div>
  );
}
