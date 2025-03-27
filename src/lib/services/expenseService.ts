// lib/services/expenseService.ts
import { Expense, Payment } from '../../types'; // Adjust the path based on the relative location

// Fetch all expenses for a household
export async function fetchExpenses(householdId: string) {
  if (!householdId || householdId === 'undefined') {
    console.error('Invalid household ID provided to fetchExpenses');
    throw new Error('Valid household ID required');
  }

  const response = await fetch(`/api/expenses?householdId=${householdId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    throw new Error('Failed to fetch expenses');
  }

  return response.json();
}

// Get a single expense
export async function fetchExpense(expenseId: string) {
  if (!expenseId) {
    throw new Error('Expense ID required');
  }

  const response = await fetch(`/api/expenses/${expenseId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include' // Include cookies for authentication
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
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    throw new Error('Failed to create expense');
  }

  return response.json();
}

// Update an expense
export async function updateExpense(expenseId: string, expenseData: Partial<Expense>) {
  if (!expenseId) {
    throw new Error('Expense ID required');
  }

  const response = await fetch(`/api/expenses/${expenseId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(expenseData),
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    throw new Error('Failed to update expense');
  }

  return response.json();
}

// Delete an expense
export async function deleteExpense(expenseId: string) {
  if (!expenseId) {
    throw new Error('Expense ID required');
  }

  const response = await fetch(`/api/expenses/${expenseId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    throw new Error('Failed to delete expense');
  }

  return response.json();
}

// Update payment status
export async function updatePaymentStatus(paymentId: string, status: 'PENDING' | 'COMPLETED' | 'DECLINED') {
  if (!paymentId) {
    throw new Error('Payment ID required');
  }

  const response = await fetch(`/api/payments/${paymentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    throw new Error('Failed to update payment status');
  }

  return response.json();
}

// Fetch household members
export async function fetchHouseholdMembers(householdId: string) {
  // Validate householdId to prevent undefined errors
  if (!householdId || householdId === 'undefined') {
    console.error('Invalid household ID provided to fetchHouseholdMembers');
    throw new Error('Valid household ID required');
  }

  console.log(`Fetching members for household ID: ${householdId}`);
  
  const response = await fetch(`/api/households/${householdId}/members`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    const status = response.status;
    console.error(`Failed to fetch household members - Status: ${status}`);
    throw new Error(`Failed to fetch household members: ${status}`);
  }

  return response.json();
}