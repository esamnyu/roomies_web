// src/types/task.ts
export interface Task {
    id: string; // Required for existing tasks
    title: string;
    description?: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    creatorId: string;
    creatorName?: string;
    assigneeId?: string;
    assigneeName?: string;
    dueDate?: Date | string;
    recurring: boolean;
    recurrenceRule?: string;
    householdId: string;
    completedAt?: Date;
  }
  
  // For creating new tasks without IDs
  export type NewTask = Omit<Task, 'id'> & { id?: string };