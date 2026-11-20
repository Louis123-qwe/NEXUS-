export type ThemePreference = 'system' | 'dark' | 'light';
export type UserRole = 'admin' | 'manager' | 'member';
export type CurrencyCode = 'USD' | 'EUR' | 'GBP';

export type NavSection =
  | 'dashboard'
  | 'crm'
  | 'projects'
  | 'finance'
  | 'tasks'
  | 'settings';

export type CustomerSegment = 'lead' | 'prospect' | 'active' | 'inactive';
export type InteractionChannel = 'email' | 'call' | 'meeting' | 'note';

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStage = 'backlog' | 'in_progress' | 'review' | 'done';

export type TransactionType = 'income' | 'expense';
export type NotificationCategory = 'task' | 'deadline' | 'finance' | 'system';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  theme: ThemePreference;
  currency: CurrencyCode;
  photoURL?: string;
}

export interface CustomerInteraction {
  id: string;
  customerId: string;
  channel: InteractionChannel;
  summary: string;
  date: string;
  ownerId: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  segment: CustomerSegment;
  value: number;
  source: string;
  notes?: string;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  id: string;
  title: string;
  clientName: string;
  status: ProjectStatus;
  budget: number;
  spent: number;
  progress: number;
  deadline: string;
  members: string[];
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskItem {
  id: string;
  projectId: string;
  title: string;
  assignee: string;
  priority: TaskPriority;
  stage: TaskStage;
  dueDate: string;
  completed: boolean;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectComment {
  id: string;
  projectId: string;
  authorName: string;
  body: string;
  ownerId: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  projectId?: string;
  receiptUrl?: string;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  ownerId: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  read: boolean;
  ownerId: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  summary: string;
  ownerId: string;
  createdAt: string;
}

export type TimeGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface DateRangeFilter {
  granularity: TimeGranularity;
  startDate: string;
  endDate: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: 'success' | 'error' | 'info' | 'warning';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  imagePreview?: string;
  timestamp: string;
}

export interface ReceiptExtraction {
  vendor: string;
  date: string;
  totalAmount: number;
  currency: string;
  category: string;
  description: string;
  lineItems: string[];
  confidence: string;
}
