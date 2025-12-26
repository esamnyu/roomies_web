// lib/services/expenseService.ts
import { Expense, Payment } from '../../types'; // Adjust the path based on the relative location

// Custom error class with additional context
export class ExpenseServiceError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = 'ExpenseServiceError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Helper to parse API error responses
async function handleApiError(response: Response, operation: string): Promise<never> {
  let errorMessage = `${operation} failed`;
  let errorDetails: unknown = undefined;

  try {
    const errorBody = await response.json();
    errorMessage = errorBody.error || errorBody.message || errorMessage;
    errorDetails = errorBody;
  } catch {
    // Response wasn't JSON, use status text
    errorMessage = `${operation}: ${response.statusText || `HTTP ${response.status}`}`;
  }

  const errorCode = `${operation.toUpperCase().replace(/ /g, '_')}_FAILED`;

  console.error(`[ExpenseService] ${operation} failed:`, {
    status: response.status,
    message: errorMessage,
    details: errorDetails,
    url: response.url,
  });

  throw new ExpenseServiceError(errorMessage, response.status, errorCode, errorDetails);
}

// Fetch all expenses for a household
export async function fetchExpenses(householdId: string) {
  if (!householdId || householdId === 'undefined') {
    console.error('[ExpenseService] Invalid household ID provided to fetchExpenses:', householdId);
    throw new ExpenseServiceError('Valid household ID required', 400, 'INVALID_HOUSEHOLD_ID');
  }

  const response = await fetch(`/api/expenses?householdId=${householdId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    await handleApiError(response, 'Fetch expenses');
  }

  return response.json();
}

// Get a single expense
export async function fetchExpense(expenseId: string) {
  if (!expenseId) {
    throw new ExpenseServiceError('Expense ID required', 400, 'INVALID_EXPENSE_ID');
  }

  const response = await fetch(`/api/expenses/${expenseId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    await handleApiError(response, 'Fetch expense');
  }

  return response.json();
}

// Create a new expense
export async function createExpense(expenseData: Omit<Expense, 'id'>) {
  console.log('[ExpenseService] Creating expense:', {
    title: expenseData.title,
    amount: expenseData.amount,
    householdId: expenseData.householdId,
    splitCount: expenseData.splits?.length,
  });

  const response = await fetch('/api/expenses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(expenseData),
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    await handleApiError(response, 'Create expense');
  }

  const result = await response.json();
  console.log('[ExpenseService] Expense created successfully:', result.id);
  return result;
}

// Update an expense
export async function updateExpense(expenseId: string, expenseData: Partial<Expense>) {
  if (!expenseId) {
    throw new ExpenseServiceError('Expense ID required', 400, 'INVALID_EXPENSE_ID');
  }

  console.log('[ExpenseService] Updating expense:', expenseId);

  const response = await fetch(`/api/expenses/${expenseId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(expenseData),
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    await handleApiError(response, 'Update expense');
  }

  const result = await response.json();
  console.log('[ExpenseService] Expense updated successfully:', expenseId);
  return result;
}

// Delete an expense
export async function deleteExpense(expenseId: string) {
  if (!expenseId) {
    throw new ExpenseServiceError('Expense ID required', 400, 'INVALID_EXPENSE_ID');
  }

  console.log('[ExpenseService] Deleting expense:', expenseId);

  const response = await fetch(`/api/expenses/${expenseId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    await handleApiError(response, 'Delete expense');
  }

  console.log('[ExpenseService] Expense deleted successfully:', expenseId);
  return response.json();
}

// Update payment status
export async function updatePaymentStatus(paymentId: string, status: 'PENDING' | 'COMPLETED' | 'DECLINED') {
  if (!paymentId) {
    throw new ExpenseServiceError('Payment ID required', 400, 'INVALID_PAYMENT_ID');
  }

  console.log('[ExpenseService] Updating payment status:', { paymentId, status });

  const response = await fetch(`/api/payments/${paymentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    await handleApiError(response, 'Update payment status');
  }

  console.log('[ExpenseService] Payment status updated successfully:', paymentId);
  return response.json();
}

// Fetch household members
export async function fetchHouseholdMembers(householdId: string) {
  // Validate householdId to prevent undefined errors
  if (!householdId || householdId === 'undefined') {
    console.error('[ExpenseService] Invalid household ID provided to fetchHouseholdMembers:', householdId);
    throw new ExpenseServiceError('Valid household ID required', 400, 'INVALID_HOUSEHOLD_ID');
  }

  console.log('[ExpenseService] Fetching members for household:', householdId);

  const response = await fetch(`/api/households/${householdId}/members`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include' // Include cookies for authentication
  });

  if (!response.ok) {
    await handleApiError(response, 'Fetch household members');
  }

  return response.json();
}