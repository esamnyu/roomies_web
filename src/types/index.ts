// types/index.ts

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
    date: Date | string; // Allow string for API interactions
    creatorId: string;
    creatorName: string;
    description?: string;
    splitType: 'EQUAL' | 'PERCENTAGE' | 'CUSTOM';
    householdId: string;
    splits: Split[];
    payments: Payment[];
  }
  
  export interface Balance {
    userId: string;
    userName: string;
    owes: number;
    isOwed: number;
    net: number;
  }