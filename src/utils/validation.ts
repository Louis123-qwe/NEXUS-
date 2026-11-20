import { CustomerSegment, ProjectStatus, TaskPriority, TaskStage, TransactionType } from '../types/nexus';

export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned.slice(0, 128) || `id_${Date.now()}`;
}

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return sanitizeId(`${prefix}_${Date.now()}_${rand}`);
}

export function isSafeHttpUrl(url: string): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateCustomerInput(input: {
  name: string;
  company: string;
  email: string;
  phone?: string;
  segment: CustomerSegment;
  value: number;
  source: string;
  notes?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim() || input.name.trim().length > 120) {
    errors.name = 'Name is required (max 120 characters).';
  }
  if (!input.company.trim() || input.company.trim().length > 120) {
    errors.company = 'Company is required (max 120 characters).';
  }
  if (!EMAIL_PATTERN.test(input.email.trim()) || input.email.trim().length > 200) {
    errors.email = 'Enter a valid email address.';
  }
  if (input.phone && input.phone.length > 40) {
    errors.phone = 'Phone must be 40 characters or fewer.';
  }
  if (Number.isNaN(input.value) || input.value < 0 || input.value > 1_000_000_000) {
    errors.value = 'Value must be between 0 and 1,000,000,000.';
  }
  if (!input.source.trim() || input.source.trim().length > 80) {
    errors.source = 'Acquisition source is required (max 80 characters).';
  }
  if (input.notes && input.notes.length > 2000) {
    errors.notes = 'Notes cannot exceed 2000 characters.';
  }
  return errors;
}

export function validateProjectInput(input: {
  title: string;
  clientName: string;
  status: ProjectStatus;
  budget: number;
  spent: number;
  progress: number;
  deadline: string;
  members: string[];
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.title.trim() || input.title.trim().length > 140) {
    errors.title = 'Project title is required (max 140 characters).';
  }
  if (!input.clientName.trim() || input.clientName.trim().length > 120) {
    errors.clientName = 'Client name is required (max 120 characters).';
  }
  if (Number.isNaN(input.budget) || input.budget < 0 || input.budget > 1_000_000_000) {
    errors.budget = 'Budget must be 0 or greater.';
  }
  if (Number.isNaN(input.spent) || input.spent < 0 || input.spent > 1_000_000_000) {
    errors.spent = 'Spent amount must be 0 or greater.';
  }
  if (Number.isNaN(input.progress) || input.progress < 0 || input.progress > 100) {
    errors.progress = 'Progress must be between 0 and 100.';
  }
  if (!input.deadline.trim()) {
    errors.deadline = 'Deadline date is required.';
  }
  if (input.members.length > 12) {
    errors.members = 'Maximum 12 assigned members per project.';
  }
  return errors;
}

export function validateTaskInput(input: {
  projectId: string;
  title: string;
  assignee: string;
  priority: TaskPriority;
  stage: TaskStage;
  dueDate: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.projectId || !ID_PATTERN.test(input.projectId)) {
    errors.projectId = 'Select a valid project.';
  }
  if (!input.title.trim() || input.title.trim().length > 160) {
    errors.title = 'Task title is required (max 160 characters).';
  }
  if (!input.assignee.trim() || input.assignee.trim().length > 80) {
    errors.assignee = 'Assignee is required (max 80 characters).';
  }
  if (!input.dueDate.trim()) {
    errors.dueDate = 'Due date is required.';
  }
  return errors;
}

export function validateTransactionInput(input: {
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  receiptUrl?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (Number.isNaN(input.amount) || input.amount <= 0 || input.amount > 1_000_000_000) {
    errors.amount = 'Amount must be greater than 0.';
  }
  if (!input.category.trim() || input.category.trim().length > 80) {
    errors.category = 'Category is required.';
  }
  if (!input.description.trim() || input.description.trim().length > 240) {
    errors.description = 'Description is required (max 240 characters).';
  }
  if (!input.date.trim()) {
    errors.date = 'Transaction date is required.';
  }
  if (input.receiptUrl && !isSafeHttpUrl(input.receiptUrl)) {
    errors.receiptUrl = 'Receipt URL must use http:// or https://.';
  }
  return errors;
}

export function escapeCsvCell(value: string | number | boolean | undefined | null): string {
  const raw = String(value ?? '');
  // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR)
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
