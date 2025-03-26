// src/types/expense.ts
export interface Member {
    id: string;
    name: string;
    avatar?: string;
  }
  
  export interface Payment {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    status: 'PENDING' | 'COMPLETED' | 'DECLINED';
    expenseId: string;
  }
  
  export interface Split {
    id?: string;
    userId: string;
    userName: string;
    amount: number;
    expenseId?: string;
  }
  
  export interface Expense {
    id?: string;
    title: string;
    amount: number;
    date: Date;
    creatorId: string;
    creatorName: string;
    description?: string;
    splitType: 'EQUAL' | 'PERCENTAGE' | 'CUSTOM';
    householdId: string;
    splits: Split[];
    payments: Payment[];
  }
  
  export interface ExpenseFormProps {
    expense: Expense | null;
    members: Member[];
    onSubmit: (expense: Expense) => void | Promise<void>; // Allow both sync and async
    onCancel: () => void;
    householdId: string;
  }