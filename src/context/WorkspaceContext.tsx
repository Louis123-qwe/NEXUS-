import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  createUserWithEmailAndPassword,
  googleProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  testConnection,
  updateProfile,
} from '../firebase';
import {
  ensureUserProfile,
  firestoreMutations,
  loadDemoWorkspace,
  resetDemoWorkspace,
  saveDemoWorkspace,
  seedFirestoreWithDemoData,
  subscribeCollectionByOwner,
  subscribeProjectSubcollection,
} from '../services/dataService';
import { NexusWorkspaceDataset } from '../data/demoData';
import {
  ActivityLog,
  Budget,
  CurrencyCode,
  Customer,
  CustomerInteraction,
  DateRangeFilter,
  NavSection,
  NotificationItem,
  Project,
  ProjectComment,
  TaskItem,
  ThemePreference,
  ToastMessage,
  Transaction,
  UserProfile,
} from '../types/nexus';
import { generateId } from '../utils/validation';

interface WorkspaceContextValue {
  // Navigation & UI
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  mobileNavOpen: boolean;
  setMobileNavOpen: React.Dispatch<React.SetStateAction<boolean>>;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  copilotOpen: boolean;
  setCopilotOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Theme & Preferences
  themePreference: ThemePreference;
  resolvedTheme: 'dark' | 'light';
  setThemePreference: (theme: ThemePreference) => void;
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;

  // Connectivity & Mode
  isOnline: boolean;
  firebaseReachable: boolean;
  authReady: boolean;
  firebaseUser: User | null;
  userProfile: UserProfile;
  isDemoMode: boolean;
  loadingData: boolean;
  dataError: string | null;

  // Auth Actions
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateOperatorProfile: (displayName: string) => Promise<void>;
  seedLiveWorkspace: () => Promise<void>;
  resetDemo: () => void;

  // Operational Data
  customers: Customer[];
  interactions: CustomerInteraction[];
  projects: Project[];
  tasks: TaskItem[];
  comments: ProjectComment[];
  transactions: Transaction[];
  budgets: Budget[];
  notifications: NotificationItem[];
  activityLogs: ActivityLog[];
  dateFilter: DateRangeFilter;
  setDateFilter: React.Dispatch<React.SetStateAction<DateRangeFilter>>;

  // Mutations
  saveCustomer: (customer: Omit<Customer, 'ownerId' | 'id'> & { id?: string }) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  addCustomerInteraction: (interaction: Omit<CustomerInteraction, 'id' | 'ownerId'>) => Promise<void>;
  saveProject: (project: Omit<Project, 'ownerId' | 'id'> & { id?: string }) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  saveTask: (task: Omit<TaskItem, 'ownerId' | 'id'> & { id?: string }) => Promise<void>;
  deleteTask: (projectId: string, taskId: string) => Promise<void>;
  addProjectComment: (projectId: string, body: string) => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'ownerId' | 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveBudget: (budget: Omit<Budget, 'ownerId' | 'id'> & { id?: string }) => Promise<void>;
  toggleNotificationRead: (id: string, read: boolean) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  exportWorkspaceJson: () => string;
  importWorkspaceJson: (jsonText: string) => void;

  // Toasts
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const THEME_STORAGE_KEY = 'nexus_theme_preference_v1';
const CURRENCY_STORAGE_KEY = 'nexus_currency_v1';

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
  );
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
    return saved === 'EUR' || saved === 'GBP' || saved === 'USD' ? saved : 'USD';
  });

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [firebaseReachable, setFirebaseReachable] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    uid: 'demo_user',
    displayName: 'Alex Rivera (Demo)',
    email: 'demo@nexus-sandbox.local',
    role: 'admin',
    theme: 'system',
    currency: 'USD',
  });

  const [demoState, setDemoState] = useState<NexusWorkspaceDataset>(() => loadDemoWorkspace());
  const [liveData, setLiveData] = useState<NexusWorkspaceDataset>({
    customers: [],
    interactions: [],
    projects: [],
    tasks: [],
    comments: [],
    transactions: [],
    budgets: [],
    notifications: [],
    activityLogs: [],
  });
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [dateFilter, setDateFilter] = useState<DateRangeFilter>({
    granularity: 'monthly',
    startDate: '2026-01-01',
    endDate: '2026-11-20',
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimers = useRef<Map<string, number>>(new Map());

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = generateId('toast');
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimers.current.delete(id);
    }, 4500);
    toastTimers.current.set(id, timer);
  }, []);

  const dismissToast = useCallback((id: string) => {
    const t = toastTimers.current.get(id);
    if (t) clearTimeout(t);
    toastTimers.current.delete(id);
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Cleanup toast timers on unmount
  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // Listen to system theme & apply .dark on <html>
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: 'dark' | 'light' =
    themePreference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themePreference;

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  const setThemePreference = useCallback((theme: ThemePreference) => {
    setThemePreferenceState(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, []);

  const setCurrency = useCallback((nextCurrency: CurrencyCode) => {
    setCurrencyState(nextCurrency);
    localStorage.setItem(CURRENCY_STORAGE_KEY, nextCurrency);
  }, []);

  // Online/offline listeners + startup Firestore check
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    testConnection().then((res) => {
      setFirebaseReachable(res.reachable);
    });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        try {
          const prof = await ensureUserProfile(
            user.uid,
            user.email || 'user@nexus.app',
            user.displayName || 'NEXUS Operator'
          );
          setUserProfile({
            ...prof,
            photoURL: user.photoURL || undefined,
          });
        } catch (err) {
          console.error('Failed to sync profile:', err);
        }
      } else {
        setUserProfile({
          uid: 'demo_user',
          displayName: 'Alex Rivera (Demo)',
          email: 'demo@nexus-sandbox.local',
          role: 'admin',
          theme: themePreference,
          currency,
        });
      }
    });
    return () => unsub();
  }, [currency, themePreference]);

  const isDemoMode = !firebaseUser;

  // Live Firestore subscriptions when authenticated
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setLoadingData(false);
      setDataError(null);
      return;
    }

    setLoadingData(true);
    setDataError(null);
    const uid = firebaseUser.uid;
    const unsubs: Array<() => void> = [];

    const onSubError = (err: Error) => {
      setDataError(err.message);
      setLoadingData(false);
    };

    unsubs.push(
      subscribeCollectionByOwner<Customer>(
        'customers',
        uid,
        (customers) => {
          setLiveData((prev) => ({ ...prev, customers }));
          setLoadingData(false);
        },
        onSubError
      )
    );
    unsubs.push(
      subscribeCollectionByOwner<Project>(
        'projects',
        uid,
        (projects) => {
          setLiveData((prev) => ({ ...prev, projects }));
          setLoadingData(false);
        },
        onSubError
      )
    );
    unsubs.push(
      subscribeCollectionByOwner<Transaction>(
        'transactions',
        uid,
        (transactions) => {
          setLiveData((prev) => ({ ...prev, transactions }));
          setLoadingData(false);
        },
        onSubError
      )
    );
    unsubs.push(
      subscribeCollectionByOwner<Budget>(
        'budgets',
        uid,
        (budgets) => {
          setLiveData((prev) => ({ ...prev, budgets }));
        },
        onSubError
      )
    );
    unsubs.push(
      subscribeCollectionByOwner<NotificationItem>(
        'notifications',
        uid,
        (notifications) => {
          setLiveData((prev) => ({ ...prev, notifications }));
        },
        onSubError
      )
    );
    unsubs.push(
      subscribeCollectionByOwner<ActivityLog>(
        'activity_logs',
        uid,
        (activityLogs) => {
          setLiveData((prev) => ({ ...prev, activityLogs }));
        },
        onSubError
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, firebaseUser]);

  // Subscribe to project tasks & comments subcollections dynamically
  useEffect(() => {
    if (!firebaseUser || liveData.projects.length === 0) return;
    const uid = firebaseUser.uid;
    const taskMap = new Map<string, TaskItem[]>();
    const commentMap = new Map<string, ProjectComment[]>();
    const unsubs: Array<() => void> = [];

    for (const proj of liveData.projects) {
      unsubs.push(
        subscribeProjectSubcollection<TaskItem>(proj.id, 'tasks', uid, (items) => {
          taskMap.set(proj.id, items);
          setLiveData((prev) => ({
            ...prev,
            tasks: Array.from(taskMap.values()).flat(),
          }));
        })
      );
      unsubs.push(
        subscribeProjectSubcollection<ProjectComment>(proj.id, 'comments', uid, (items) => {
          commentMap.set(proj.id, items);
          setLiveData((prev) => ({
            ...prev,
            comments: Array.from(commentMap.values()).flat(),
          }));
        })
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseUser, liveData.projects]);

  const activeData = isDemoMode ? demoState : liveData;

  const persistDemo = useCallback((updater: (prev: NexusWorkspaceDataset) => NexusWorkspaceDataset) => {
    setDemoState((prev) => {
      const next = updater(prev);
      saveDemoWorkspace(next);
      return next;
    });
  }, []);

  const recordLog = useCallback(
    async (action: string, entityType: string, summary: string) => {
      const actor = userProfile.displayName;
      if (isDemoMode) {
        persistDemo((prev) => ({
          ...prev,
          activityLogs: [
            {
              id: generateId('act'),
              actor,
              action,
              entityType,
              summary,
              ownerId: 'demo_user',
              createdAt: new Date().toISOString(),
            },
            ...prev.activityLogs,
          ].slice(0, 60),
        }));
      } else if (firebaseUser) {
        await firestoreMutations.logActivity(firebaseUser.uid, {
          id: generateId('act'),
          actor,
          action,
          entityType,
          summary,
        });
      }
    },
    [firebaseUser, isDemoMode, persistDemo, userProfile.displayName]
  );

  // Auth Methods
  const loginWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      pushToast({ title: 'Signed in with Google', description: 'Live Firestore sync is active.', variant: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google Sign-In failed.';
      pushToast({ title: 'Sign-In failed', description: message, variant: 'error' });
    }
  }, [pushToast]);

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        pushToast({ title: 'Signed in', description: 'Live Firestore workspace loaded.', variant: 'success' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Email sign-in failed.';
        pushToast({
          title: 'Email sign-in unavailable',
          description: `${message} Note: Email/Password provider must be enabled in Firebase Console, or use Google Sign-In.`,
          variant: 'error',
        });
        throw err;
      }
    },
    [pushToast]
  );

  const registerWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await sendEmailVerification(cred.user);
        pushToast({
          title: 'Account created',
          description: 'Verification email sent. Please verify your email before writing to Firestore.',
          variant: 'success',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed.';
        pushToast({
          title: 'Registration failed',
          description: `${message} Note: Enable Email/Password in Firebase Console or sign in with Google.`,
          variant: 'error',
        });
        throw err;
      }
    },
    [pushToast]
  );

  const requestPasswordReset = useCallback(
    async (email: string) => {
      try {
        await sendPasswordResetEmail(auth, email);
        pushToast({
          title: 'Reset email sent',
          description: `Check ${email} for password reset instructions.`,
          variant: 'info',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to send reset email.';
        pushToast({ title: 'Password reset failed', description: message, variant: 'error' });
        throw err;
      }
    },
    [pushToast]
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    pushToast({
      title: 'Signed out',
      description: 'Switched back to Demo Sandbox mode.',
      variant: 'info',
    });
  }, [pushToast]);

  const updateOperatorProfile = useCallback(
    async (displayName: string) => {
      const clean = displayName.trim().slice(0, 120);
      if (!clean) return;
      if (firebaseUser) {
        await updateProfile(firebaseUser, { displayName: clean });
        await ensureUserProfile(firebaseUser.uid, firebaseUser.email || '', clean);
      }
      setUserProfile((prev) => ({ ...prev, displayName: clean }));
      pushToast({ title: 'Profile updated', variant: 'success' });
    },
    [firebaseUser, pushToast]
  );

  const seedLiveWorkspace = useCallback(async () => {
    if (!firebaseUser) return;
    await seedFirestoreWithDemoData(firebaseUser.uid);
    pushToast({
      title: 'Sample operational data seeded',
      description: 'Added starter customers, projects, transactions, and budgets to your Firestore workspace.',
      variant: 'success',
    });
  }, [firebaseUser, pushToast]);

  const resetDemo = useCallback(() => {
    const fresh = resetDemoWorkspace();
    setDemoState(fresh);
    pushToast({ title: 'Demo Sandbox reset to defaults', variant: 'info' });
  }, [pushToast]);

  // Domain CRUD
  const saveCustomer = useCallback(
    async (customer: Omit<Customer, 'ownerId' | 'id'> & { id?: string }) => {
      const id = customer.id || generateId('cust');
      if (isDemoMode) {
        persistDemo((prev) => {
          const exists = prev.customers.some((c) => c.id === id);
          const nextCustomers = exists
            ? prev.customers.map((c) => (c.id === id ? { ...c, ...customer, id } : c))
            : [{ ...customer, id, ownerId: 'demo_user' }, ...prev.customers];
          return { ...prev, customers: nextCustomers };
        });
      } else if (firebaseUser) {
        const exists = activeData.customers.some((c) => c.id === id);
        if (exists) {
          await firestoreMutations.updateCustomer(id, {
            name: customer.name,
            company: customer.company,
            email: customer.email,
            phone: customer.phone || '',
            segment: customer.segment,
            value: Number(customer.value),
            source: customer.source,
            notes: customer.notes || '',
          });
        } else {
          await firestoreMutations.upsertCustomer(firebaseUser.uid, { ...customer, id });
        }
      }
      await recordLog(customer.id ? 'Updated' : 'Created', 'Customer', `${customer.name} (${customer.company})`);
      pushToast({ title: customer.id ? 'Customer updated' : 'Customer created', variant: 'success' });
    },
    [activeData.customers, firebaseUser, isDemoMode, persistDemo, pushToast, recordLog]
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      const target = activeData.customers.find((c) => c.id === id);
      if (isDemoMode) {
        persistDemo((prev) => ({
          ...prev,
          customers: prev.customers.filter((c) => c.id !== id),
          interactions: prev.interactions.filter((i) => i.customerId !== id),
        }));
      } else {
        await firestoreMutations.deleteCustomer(id);
      }
      await recordLog('Deleted', 'Customer', target?.name || id);
      pushToast({ title: 'Customer removed', variant: 'info' });
    },
    [activeData.customers, isDemoMode, persistDemo, pushToast, recordLog]
  );

  const addCustomerInteraction = useCallback(
    async (interaction: Omit<CustomerInteraction, 'id' | 'ownerId'>) => {
      const id = generateId('int');
      if (isDemoMode) {
        persistDemo((prev) => ({
          ...prev,
          interactions: [{ ...interaction, id, ownerId: 'demo_user' }, ...prev.interactions],
        }));
      } else if (firebaseUser) {
        await firestoreMutations.addInteraction(firebaseUser.uid, { ...interaction, id });
      }
      await recordLog('Logged', 'CRM Contact', `${interaction.channel}: ${interaction.summary.slice(0, 60)}`);
      pushToast({ title: 'Contact entry logged', variant: 'success' });
    },
    [firebaseUser, isDemoMode, persistDemo, pushToast, recordLog]
  );

  const saveProject = useCallback(
    async (project: Omit<Project, 'ownerId' | 'id'> & { id?: string }) => {
      const id = project.id || generateId('proj');
      if (isDemoMode) {
        persistDemo((prev) => {
          const exists = prev.projects.some((p) => p.id === id);
          const nextProjects = exists
            ? prev.projects.map((p) => (p.id === id ? { ...p, ...project, id } : p))
            : [{ ...project, id, ownerId: 'demo_user' }, ...prev.projects];
          return { ...prev, projects: nextProjects };
        });
      } else if (firebaseUser) {
        const exists = activeData.projects.some((p) => p.id === id);
        if (exists) {
          await firestoreMutations.updateProject(id, {
            title: project.title,
            clientName: project.clientName,
            status: project.status,
            budget: Number(project.budget),
            spent: Number(project.spent),
            progress: Number(project.progress),
            deadline: project.deadline,
            members: project.members.slice(0, 12),
          });
        } else {
          await firestoreMutations.createProject(firebaseUser.uid, { ...project, id });
        }
      }
      await recordLog(project.id ? 'Updated' : 'Created', 'Project', project.title);
      pushToast({ title: project.id ? 'Project updated' : 'Project created', variant: 'success' });
    },
    [activeData.projects, firebaseUser, isDemoMode, persistDemo, pushToast, recordLog]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      const target = activeData.projects.find((p) => p.id === id);
      if (isDemoMode) {
        persistDemo((prev) => ({
          ...prev,
          projects: prev.projects.filter((p) => p.id !== id),
          tasks: prev.tasks.filter((t) => t.projectId !== id),
          comments: prev.comments.filter((c) => c.projectId !== id),
        }));
      } else {
        await firestoreMutations.deleteProject(id);
      }
      await recordLog('Deleted', 'Project', target?.title || id);
      pushToast({ title: 'Project deleted', variant: 'info' });
    },
    [activeData.projects, isDemoMode, persistDemo, pushToast, recordLog]
  );

  const saveTask = useCallback(
    async (task: Omit<TaskItem, 'ownerId' | 'id'> & { id?: string }) => {
      const id = task.id || generateId('task');
      if (isDemoMode) {
        persistDemo((prev) => {
          const exists = prev.tasks.some((t) => t.id === id);
          const nextTasks = exists
            ? prev.tasks.map((t) => (t.id === id ? { ...t, ...task, id } : t))
            : [{ ...task, id, ownerId: 'demo_user' }, ...prev.tasks];
          return { ...prev, tasks: nextTasks };
        });
      } else if (firebaseUser) {
        const exists = activeData.tasks.some((t) => t.id === id);
        if (exists) {
          await firestoreMutations.updateTask(task.projectId, id, {
            title: task.title,
            assignee: task.assignee,
            priority: task.priority,
            stage: task.stage,
            dueDate: task.dueDate,
            completed: task.completed,
          });
        } else {
          await firestoreMutations.createTask(firebaseUser.uid, { ...task, id });
        }
      }
      await recordLog(task.id ? 'Updated' : 'Created', 'Task', `${task.title} (${task.stage})`);
    },
    [activeData.tasks, firebaseUser, isDemoMode, persistDemo, recordLog]
  );

  const deleteTask = useCallback(
    async (projectId: string, taskId: string) => {
      if (isDemoMode) {
        persistDemo((prev) => ({
          ...prev,
          tasks: prev.tasks.filter((t) => t.id !== taskId),
        }));
      } else {
        await firestoreMutations.deleteTask(projectId, taskId);
      }
      pushToast({ title: 'Task removed', variant: 'info' });
    },
    [isDemoMode, persistDemo, pushToast]
  );

  const addProjectComment = useCallback(
    async (projectId: string, body: string) => {
      const id = generateId('cmt');
      const authorName = userProfile.displayName.replace(' (Demo)', '');
      if (isDemoMode) {
        persistDemo((prev) => ({
          ...prev,
          comments: [
            ...prev.comments,
            {
              id,
              projectId,
              authorName,
              body,
              ownerId: 'demo_user',
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      } else if (firebaseUser) {
        await firestoreMutations.addProjectComment(firebaseUser.uid, {
          id,
          projectId,
          authorName,
          body,
        });
      }
      await recordLog('Commented', 'Project', body.slice(0, 60));
    },
    [firebaseUser, isDemoMode, persistDemo, recordLog, userProfile.displayName]
  );

  const addTransaction = useCallback(
    async (tx: Omit<Transaction, 'ownerId' | 'id'>) => {
      const id = generateId('tx');
      if (isDemoMode) {
        persistDemo((prev) => ({
          ...prev,
          transactions: [{ ...tx, id, ownerId: 'demo_user' }, ...prev.transactions],
          notifications: [
            {
              id: generateId('notif'),
              title: tx.type === 'income' ? 'Income Recorded' : 'Expense Recorded',
              message: `${tx.description} ($${tx.amount.toLocaleString()}) added to ledger.`,
              category: 'finance',
              read: false,
              ownerId: 'demo_user',
              createdAt: new Date().toISOString(),
            },
            ...prev.notifications,
          ],
        }));
      } else if (firebaseUser) {
        await firestoreMutations.createTransaction(firebaseUser.uid, { ...tx, id });
        await firestoreMutations.createNotification(firebaseUser.uid, {
          id: generateId('notif'),
          title: tx.type === 'income' ? 'Income Recorded' : 'Expense Recorded',
          message: `${tx.description} ($${tx.amount.toLocaleString()}) added to ledger.`,
          category: 'finance',
          read: false,
        });
      }
      await recordLog('Recorded', 'Transaction', `${tx.type.toUpperCase()} $${tx.amount} — ${tx.description}`);
      pushToast({ title: 'Transaction recorded', variant: 'success' });
    },
    [firebaseUser, isDemoMode, persistDemo, pushToast, recordLog]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        persistDemo((prev) => ({
          ...prev,
          transactions: prev.transactions.filter((t) => t.id !== id),
        }));
      } else {
        await firestoreMutations.deleteTransaction(id);
      }
      await recordLog('Deleted', 'Transaction', id);
      pushToast({ title: 'Transaction deleted', variant: 'info' });
    },
    [isDemoMode, persistDemo, pushToast, recordLog]
  );

  const saveBudget = useCallback(
    async (budget: Omit<Budget, 'ownerId' | 'id'> & { id?: string }) => {
      const id = budget.id || generateId('bud');
      if (isDemoMode) {
        persistDemo((prev) => {
          const exists = prev.budgets.some((b) => b.id === id);
          const next = exists
            ? prev.budgets.map((b) => (b.id === id ? { ...b, ...budget, id } : b))
            : [...prev.budgets, { ...budget, id, ownerId: 'demo_user' }];
          return { ...prev, budgets: next };
        });
      } else if (firebaseUser) {
        await firestoreMutations.upsertBudget(firebaseUser.uid, { ...budget, id });
      }
      pushToast({ title: 'Category budget updated', variant: 'success' });
    },
    [firebaseUser, isDemoMode, persistDemo, pushToast]
  );

  const toggleNotificationRead = useCallback(
    async (id: string, read: boolean) => {
      if (isDemoMode) {
        persistDemo((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read } : n)),
        }));
      } else {
        await firestoreMutations.markNotificationRead(id, read);
      }
    },
    [isDemoMode, persistDemo]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (isDemoMode) {
      persistDemo((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, read: true })),
      }));
    } else {
      await Promise.all(
        activeData.notifications
          .filter((n) => !n.read)
          .map((n) => firestoreMutations.markNotificationRead(n.id, true))
      );
    }
  }, [activeData.notifications, isDemoMode, persistDemo]);

  const exportWorkspaceJson = useCallback(() => {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        mode: isDemoMode ? 'demo' : 'firebase',
        data: activeData,
      },
      null,
      2
    );
  }, [activeData, isDemoMode]);

  const importWorkspaceJson = useCallback(
    (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText) as { data?: Partial<NexusWorkspaceDataset> };
        const src = parsed.data || (parsed as Partial<NexusWorkspaceDataset>);
        if (!Array.isArray(src.customers) || !Array.isArray(src.transactions)) {
          throw new Error('Invalid NEXUS backup format: missing customers or transactions arrays.');
        }
        persistDemo((prev) => ({
          ...prev,
          customers: src.customers || prev.customers,
          projects: Array.isArray(src.projects) ? src.projects : prev.projects,
          tasks: Array.isArray(src.tasks) ? src.tasks : prev.tasks,
          transactions: src.transactions || prev.transactions,
          budgets: Array.isArray(src.budgets) ? src.budgets : prev.budgets,
        }));
        pushToast({
          title: 'Workspace data imported',
          description: 'Backup loaded into local workspace.',
          variant: 'success',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid JSON file.';
        pushToast({ title: 'Import failed', description: message, variant: 'error' });
      }
    },
    [persistDemo, pushToast]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      activeSection,
      setActiveSection,
      sidebarCollapsed,
      setSidebarCollapsed,
      mobileNavOpen,
      setMobileNavOpen,
      commandPaletteOpen,
      setCommandPaletteOpen,
      copilotOpen,
      setCopilotOpen,
      themePreference,
      resolvedTheme,
      setThemePreference,
      currency,
      setCurrency,
      isOnline,
      firebaseReachable,
      authReady,
      firebaseUser,
      userProfile,
      isDemoMode,
      loadingData,
      dataError,
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      requestPasswordReset,
      logout,
      updateOperatorProfile,
      seedLiveWorkspace,
      resetDemo,
      customers: activeData.customers,
      interactions: activeData.interactions,
      projects: activeData.projects,
      tasks: activeData.tasks,
      comments: activeData.comments,
      transactions: activeData.transactions,
      budgets: activeData.budgets,
      notifications: activeData.notifications,
      activityLogs: activeData.activityLogs,
      dateFilter,
      setDateFilter,
      saveCustomer,
      deleteCustomer,
      addCustomerInteraction,
      saveProject,
      deleteProject,
      saveTask,
      deleteTask,
      addProjectComment,
      addTransaction,
      deleteTransaction,
      saveBudget,
      toggleNotificationRead,
      markAllNotificationsRead,
      exportWorkspaceJson,
      importWorkspaceJson,
      toasts,
      pushToast,
      dismissToast,
    }),
    [
      activeData,
      activeSection,
      addCustomerInteraction,
      addProjectComment,
      addTransaction,
      authReady,
      commandPaletteOpen,
      copilotOpen,
      currency,
      dataError,
      dateFilter,
      deleteCustomer,
      deleteProject,
      deleteTask,
      deleteTransaction,
      dismissToast,
      exportWorkspaceJson,
      firebaseReachable,
      firebaseUser,
      importWorkspaceJson,
      isDemoMode,
      isOnline,
      loadingData,
      loginWithEmail,
      loginWithGoogle,
      logout,
      markAllNotificationsRead,
      mobileNavOpen,
      pushToast,
      registerWithEmail,
      requestPasswordReset,
      resetDemo,
      resolvedTheme,
      saveBudget,
      saveCustomer,
      saveProject,
      saveTask,
      seedLiveWorkspace,
      setCurrency,
      setThemePreference,
      sidebarCollapsed,
      themePreference,
      toasts,
      toggleNotificationRead,
      updateOperatorProfile,
      userProfile,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
