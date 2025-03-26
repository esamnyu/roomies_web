// lib/services/expenseService.ts
import { Expense, Payment } from '../../types'; // Adjust the path based on the relative location

// Fetch all expenses for a household
export async function fetchExpenses(householdId: string) {
  const response = await fetch(`/api/expenses?householdId=${householdId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch expenses');
  }

  return response.json();
}

// Get a single expense
export async function fetchExpense(expenseId: string) {
  const response = await fetch(`/api/expenses/${expenseId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch expense');
  }

  return response.json();
}

// Create a new expense
export async function createExpense(expenseData: Omit<Expense, 'id'>) {
  const response = await fetch('/api/expenses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(expenseData),
  });

  if (!response.ok) {
    throw new Error('Failed to create expense');
  }

  return response.json();
}

// Update an expense
export async function updateExpense(expenseId: string, expenseData: Partial<Expense>) {
  const response = await fetch(`/api/expenses/${expenseId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(expenseData),
  });

  if (!response.ok) {
    throw new Error('Failed to update expense');
  }

  return response.json();
}

// Delete an expense
export async function deleteExpense(expenseId: string) {
  const response = await fetch(`/api/expenses/${expenseId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete expense');
  }

  return response.json();
}

// Update payment status
export async function updatePaymentStatus(paymentId: string, status: 'PENDING' | 'COMPLETED' | 'DECLINED') {
  const response = await fetch(`/api/payments/${paymentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error('Failed to update payment status');
  }

  return response.json();
}

// Fetch household members
export async function fetchHouseholdMembers(householdId: string) {
  const response = await fetch(`/api/households/${householdId}/members`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch household members');
  }

  return response.json();
}