import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { createDemoDataset, NexusWorkspaceDataset } from '../data/demoData';
import {
  ActivityLog,
  Budget,
  Customer,
  CustomerInteraction,
  NotificationItem,
  Project,
  ProjectComment,
  TaskItem,
  Transaction,
  UserProfile,
} from '../types/nexus';
import { generateId } from '../utils/validation';

const DEMO_STORAGE_KEY = 'nexus_demo_workspace_v1';

export function loadDemoWorkspace(): NexusWorkspaceDataset {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NexusWorkspaceDataset>;
      const fallback = createDemoDataset('demo_user');
      return {
        customers: Array.isArray(parsed.customers) ? parsed.customers : fallback.customers,
        interactions: Array.isArray(parsed.interactions) ? parsed.interactions : fallback.interactions,
        projects: Array.isArray(parsed.projects) ? parsed.projects : fallback.projects,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : fallback.tasks,
        comments: Array.isArray(parsed.comments) ? parsed.comments : fallback.comments,
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : fallback.transactions,
        budgets: Array.isArray(parsed.budgets) ? parsed.budgets : fallback.budgets,
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : fallback.notifications,
        activityLogs: Array.isArray(parsed.activityLogs) ? parsed.activityLogs : fallback.activityLogs,
      };
    }
  } catch (err) {
    console.warn('Failed to load demo workspace from storage:', err);
  }
  const initial = createDemoDataset('demo_user');
  saveDemoWorkspace(initial);
  return initial;
}

export function saveDemoWorkspace(data: NexusWorkspaceDataset): void {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to persist demo workspace:', err);
  }
}

export function resetDemoWorkspace(): NexusWorkspaceDataset {
  const fresh = createDemoDataset('demo_user');
  saveDemoWorkspace(fresh);
  return fresh;
}

export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string
): Promise<UserProfile> {
  const userRef = doc(db, 'users', uid);
  const role = email === 'ekeminiabasilouis@gmail.com' ? 'admin' : 'member';
  const profile: UserProfile = {
    uid,
    displayName: displayName || email.split('@')[0] || 'Operator',
    email,
    role,
    theme: 'system',
    currency: 'USD',
  };

  try {
    await setDoc(
      userRef,
      {
        ...profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    // If already exists and merge attempted with createdAt, update safe fields only
    try {
      await updateDoc(userRef, {
        displayName: profile.displayName,
        updatedAt: serverTimestamp(),
      });
    } catch (innerError) {
      handleFirestoreError(innerError, OperationType.WRITE, `users/${uid}`);
    }
  }
  return profile;
}

export async function seedFirestoreWithDemoData(uid: string): Promise<void> {
  const demo = createDemoDataset(uid);
  const batch = writeBatch(db);

  for (const c of demo.customers.slice(0, 6)) {
    const ref = doc(db, 'customers', generateId('cust'));
    batch.set(ref, {
      name: c.name,
      company: c.company,
      email: c.email,
      phone: c.phone || '',
      segment: c.segment,
      value: c.value,
      source: c.source,
      notes: c.notes || '',
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const p of demo.projects.slice(0, 3)) {
    const pId = generateId('proj');
    const pRef = doc(db, 'projects', pId);
    batch.set(pRef, {
      title: p.title,
      clientName: p.clientName,
      status: p.status,
      budget: p.budget,
      spent: p.spent,
      progress: p.progress,
      deadline: p.deadline,
      members: p.members,
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const tx of demo.transactions.slice(-8)) {
    const txRef = doc(db, 'transactions', generateId('tx'));
    batch.set(txRef, {
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      description: tx.description,
      date: tx.date,
      projectId: tx.projectId || '',
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const b of demo.budgets) {
    const bRef = doc(db, 'budgets', generateId('bud'));
    batch.set(bRef, {
      category: b.category,
      monthlyLimit: b.monthlyLimit,
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const n of demo.notifications.slice(0, 3)) {
    const nRef = doc(db, 'notifications', generateId('notif'));
    batch.set(nRef, {
      title: n.title,
      message: n.message,
      category: n.category,
      read: n.read,
      ownerId: uid,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'batch_seed');
  }
}

export function subscribeCollectionByOwner<T>(
  collectionName: string,
  uid: string,
  onData: (items: T[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, collectionName), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        ...(d.data() as Record<string, unknown>),
        id: d.id,
      })) as T[];
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, collectionName);
    }
  );
}

export function subscribeProjectSubcollection<T>(
  projectId: string,
  subcollection: 'tasks' | 'comments',
  uid: string,
  onData: (items: T[]) => void
): Unsubscribe {
  const path = `projects/${projectId}/${subcollection}`;
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        ...(d.data() as Record<string, unknown>),
        id: d.id,
      })) as T[];
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

// Firestore CRUD helpers
export const firestoreMutations = {
  async upsertCustomer(uid: string, customer: Omit<Customer, 'ownerId'>): Promise<void> {
    const id = customer.id || generateId('cust');
    const path = `customers/${id}`;
    const ref = doc(db, 'customers', id);
    try {
      await setDoc(ref, {
        name: customer.name,
        company: customer.company,
        email: customer.email,
        phone: customer.phone || '',
        segment: customer.segment,
        value: Number(customer.value),
        source: customer.source,
        notes: customer.notes || '',
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateCustomer(customerId: string, patch: Partial<Customer>): Promise<void> {
    const path = `customers/${customerId}`;
    try {
      await updateDoc(doc(db, 'customers', customerId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteCustomer(customerId: string): Promise<void> {
    const path = `customers/${customerId}`;
    try {
      await deleteDoc(doc(db, 'customers', customerId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async addInteraction(uid: string, interaction: Omit<CustomerInteraction, 'ownerId'>): Promise<void> {
    const id = interaction.id || generateId('int');
    const path = `customers/${interaction.customerId}/interactions/${id}`;
    try {
      await setDoc(doc(db, `customers/${interaction.customerId}/interactions`, id), {
        customerId: interaction.customerId,
        channel: interaction.channel,
        summary: interaction.summary,
        date: interaction.date,
        ownerId: uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async createProject(uid: string, project: Omit<Project, 'ownerId'>): Promise<void> {
    const id = project.id || generateId('proj');
    const path = `projects/${id}`;
    try {
      await setDoc(doc(db, 'projects', id), {
        title: project.title,
        clientName: project.clientName,
        status: project.status,
        budget: Number(project.budget),
        spent: Number(project.spent),
        progress: Number(project.progress),
        deadline: project.deadline,
        members: project.members.slice(0, 12),
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateProject(projectId: string, patch: Partial<Project>): Promise<void> {
    const path = `projects/${projectId}`;
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteProject(projectId: string): Promise<void> {
    const path = `projects/${projectId}`;
    try {
      await deleteDoc(doc(db, 'projects', projectId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async createTask(uid: string, task: Omit<TaskItem, 'ownerId'>): Promise<void> {
    const id = task.id || generateId('task');
    const path = `projects/${task.projectId}/tasks/${id}`;
    try {
      await setDoc(doc(db, `projects/${task.projectId}/tasks`, id), {
        projectId: task.projectId,
        title: task.title,
        assignee: task.assignee,
        priority: task.priority,
        stage: task.stage,
        dueDate: task.dueDate,
        completed: Boolean(task.completed),
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateTask(projectId: string, taskId: string, patch: Partial<TaskItem>): Promise<void> {
    const path = `projects/${projectId}/tasks/${taskId}`;
    try {
      await updateDoc(doc(db, `projects/${projectId}/tasks`, taskId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteTask(projectId: string, taskId: string): Promise<void> {
    const path = `projects/${projectId}/tasks/${taskId}`;
    try {
      await deleteDoc(doc(db, `projects/${projectId}/tasks`, taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async addProjectComment(uid: string, comment: Omit<ProjectComment, 'ownerId' | 'createdAt'>): Promise<void> {
    const id = comment.id || generateId('cmt');
    const path = `projects/${comment.projectId}/comments/${id}`;
    try {
      await setDoc(doc(db, `projects/${comment.projectId}/comments`, id), {
        projectId: comment.projectId,
        authorName: comment.authorName,
        body: comment.body,
        ownerId: uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async createTransaction(uid: string, tx: Omit<Transaction, 'ownerId'>): Promise<void> {
    const id = tx.id || generateId('tx');
    const path = `transactions/${id}`;
    try {
      await setDoc(doc(db, 'transactions', id), {
        type: tx.type,
        amount: Number(tx.amount),
        category: tx.category,
        description: tx.description,
        date: tx.date,
        ...(tx.projectId ? { projectId: tx.projectId } : {}),
        ...(tx.receiptUrl ? { receiptUrl: tx.receiptUrl } : {}),
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async deleteTransaction(txId: string): Promise<void> {
    const path = `transactions/${txId}`;
    try {
      await deleteDoc(doc(db, 'transactions', txId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async upsertBudget(uid: string, budget: Omit<Budget, 'ownerId'>): Promise<void> {
    const id = budget.id || generateId('bud');
    const path = `budgets/${id}`;
    try {
      await setDoc(doc(db, 'budgets', id), {
        category: budget.category,
        monthlyLimit: Number(budget.monthlyLimit),
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async createNotification(uid: string, notif: Omit<NotificationItem, 'ownerId' | 'createdAt'>): Promise<void> {
    const id = notif.id || generateId('notif');
    const path = `notifications/${id}`;
    try {
      await setDoc(doc(db, 'notifications', id), {
        title: notif.title,
        message: notif.message,
        category: notif.category,
        read: notif.read,
        ownerId: uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async markNotificationRead(notifId: string, read: boolean): Promise<void> {
    const path = `notifications/${notifId}`;
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async logActivity(uid: string, log: Omit<ActivityLog, 'ownerId' | 'createdAt'>): Promise<void> {
    const id = log.id || generateId('act');
    const path = `activity_logs/${id}`;
    try {
      await setDoc(doc(db, 'activity_logs', id), {
        actor: log.actor,
        action: log.action,
        entityType: log.entityType,
        summary: log.summary,
        ownerId: uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },
};
