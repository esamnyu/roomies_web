// src/components/expenses/ExpenseForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase';

// Aligned interface definitions with the page component
interface Member {
  id: string;
  name: string;
  avatar?: string;
}

interface Split {
  id?: string; // Add optional id for backend reference
  userId: string;
  userName: string;
  amount: number;
  percentage?: number;
  expenseId?: string; // Add optional reference to parent expense
}

interface Payment {
  id?: string; // Make id optional to support new payments
  userId: string;
  userName: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'DECLINED';
  expenseId?: string; // Add optional reference to parent expense
}

interface Expense {
  id?: string;
  title: string;
  amount: number;
  date: Date;
  description?: string;
  splitType: 'EQUAL' | 'PERCENTAGE' | 'CUSTOM';
  creatorId: string;
  creatorName: string;
  householdId: string;
  splits: Split[];
  payments: Payment[];
}

interface ExpenseFormProps {
  expense: Expense | null; // Changed to non-optional (but still nullable) to match usage/suggestion
  members: Member[];
  householdId: string;
  onSubmit: (expense: Expense) => void | Promise<void>; // Allow async function
  onCancel: () => void;
}

export default function ExpenseForm({
  expense,
  members,
  householdId,
  onSubmit,
  onCancel
}: ExpenseFormProps) {
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Get current user from Supabase auth
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      setCurrentUserId(session?.user?.id || '');
    };
    getUser();
  }, []);

  const currentUser = members.find(m => m.id === currentUserId);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default state for a new expense
  const getDefaultState = () => ({
    title: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0], // Today in YYYY-MM-DD format
    description: '',
    splitType: 'EQUAL' as const,
    creatorId: currentUserId,
    creatorName: currentUser?.name || '',
    householdId,
    splits: [],
    payments: []
  });

  const [formData, setFormData] = useState<Omit<Expense, 'date'> & { date: string }>(getDefaultState());
  const [splitPercentages, setSplitPercentages] = useState<Record<string, number>>({});
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Initialize form data when expense prop changes or user session loads
  useEffect(() => {
    if (!currentUserId) return; // Wait for user session

    if (expense) {
      const tempSplitPercentages: Record<string, number> = {};
      const tempSplitAmounts: Record<string, number> = {};

      expense.splits.forEach(split => {
        tempSplitPercentages[split.userId] = split.percentage || 0;
        tempSplitAmounts[split.userId] = split.amount;
      });

      setSplitPercentages(tempSplitPercentages);
      setSplitAmounts(tempSplitAmounts);

      setFormData({
        ...expense,
        date: expense.date.toISOString().split('T')[0] // Convert Date to YYYY-MM-DD
      });
    } else {
      // Initialize equal splits for new expense
      const membersCount = members.length;
      const tempSplitPercentages: Record<string, number> = {};
      const tempSplitAmounts: Record<string, number> = {};

      members.forEach(member => {
        tempSplitPercentages[member.id] = 100 / membersCount;
        tempSplitAmounts[member.id] = 0; // Will be calculated when amount is set
      });

      setSplitPercentages(tempSplitPercentages);
      setSplitAmounts(tempSplitAmounts);

      setFormData({
        ...getDefaultState(),
        creatorId: currentUserId,
        creatorName: currentUser?.name || '',
      });
    }
  }, [expense, members, currentUserId, currentUser, householdId]);

  // Calculate splits when amount or splitType changes
  useEffect(() => {
    if (formData.amount > 0) {
      calculateSplits();
    }
  }, [formData.amount, formData.splitType]);

  const calculateSplits = () => {
    const amount = formData.amount;
    const tempSplitAmounts: Record<string, number> = {};

    if (formData.splitType === 'EQUAL') {
      // Equal split
      const memberCount = members.length;
      const equalAmount = amount / memberCount;

      members.forEach((member, index) => {
        // Handle rounding issues by adjusting the last member's amount
        if (index === memberCount - 1) {
          const sum = Object.values(tempSplitAmounts).reduce((a, b) => a + b, 0);
          tempSplitAmounts[member.id] = +(amount - sum).toFixed(2);
        } else {
          tempSplitAmounts[member.id] = +equalAmount.toFixed(2);
        }
      });
    } else if (formData.splitType === 'PERCENTAGE') {
      // Percentage-based split
      members.forEach(member => {
        const percentage = splitPercentages[member.id] || 0;
        tempSplitAmounts[member.id] = +(amount * percentage / 100).toFixed(2);
      });
    }
    // For CUSTOM, we don't calculate automatically - user sets amounts directly

    setSplitAmounts(tempSplitAmounts);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'amount') {
      const numValue = parseFloat(value);
      setFormData({ ...formData, [name]: numValue || 0 });
    } else {
      setFormData({ ...formData, [name]: value });
    }

    // Clear error when field is edited
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: '' });
    }
  };

  const handlePercentageChange = (userId: string, value: number) => {
    const newPercentages = { ...splitPercentages, [userId]: value };
    setSplitPercentages(newPercentages);

    // Recalculate amounts based on new percentages
    if (formData.amount > 0) {
      const newSplitAmounts = { ...splitAmounts };
      newSplitAmounts[userId] = +(formData.amount * value / 100).toFixed(2);
      setSplitAmounts(newSplitAmounts);
    }
  };

  const handleAmountChange = (userId: string, value: number) => {
    const newSplitAmounts = { ...splitAmounts, [userId]: value };
    setSplitAmounts(newSplitAmounts);

    // Update percentages if amount is greater than 0
    if (formData.amount > 0) {
      const newPercentages = { ...splitPercentages };
      newPercentages[userId] = +(value / formData.amount * 100).toFixed(2);
      setSplitPercentages(newPercentages);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (formData.splitType === 'PERCENTAGE') {
      const totalPercentage = Object.values(splitPercentages).reduce((a, b) => a + b, 0);
      if (Math.abs(totalPercentage - 100) > 0.1) { // Allow small rounding errors
        newErrors.splitType = 'Percentages must add up to 100%';
      }
    } else if (formData.splitType === 'CUSTOM') {
      const totalAmount = Object.values(splitAmounts).reduce((a, b) => a + b, 0);
      if (Math.abs(totalAmount - formData.amount) > 0.01) { // Allow small rounding errors
        newErrors.splitType = 'Split amounts must add up to the total amount';
      }
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create splits array (Aligned with suggested logic)
      const splits = members.map(member => ({
        id: expense?.splits.find(s => s.userId === member.id)?.id, // Preserve existing split IDs if editing
        userId: member.id,
        userName: member.name,
        amount: splitAmounts[member.id] || 0,
        percentage: splitPercentages[member.id] || 0,
        expenseId: expense?.id // Add reference to parent expense if editing
      }));

      // Create payments array - the creator is paid, everyone else pays (Aligned with suggested logic)
      const payments = members
        .filter(member => member.id !== formData.creatorId) // Exclude creator
        .map(member => {
          const existingPayment = expense?.payments.find(p => p.userId === member.id);
          return {
            id: existingPayment?.id, // Preserve existing payment IDs if editing
            userId: member.id,
            userName: member.name,
            amount: splitAmounts[member.id] || 0,
            status: existingPayment?.status || 'PENDING' as const, // Preserve status or default to PENDING
            expenseId: expense?.id // Add reference to parent expense if editing
          };
        });

      // Prepare the expense data
      const expenseData = {
        ...formData,
        id: expense?.id, // Include expense id if updating
        date: new Date(formData.date), // Convert string back to Date
        splits,
        payments
      };

      // Call the onSubmit callback with the expense data (Replaced fetch logic)
      await onSubmit(expenseData); // Use await since onSubmit can be async

    } catch (err) {
      console.error('Error saving expense via onSubmit:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while saving the expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  // JSX part of the component remains the same
  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={formData.title}
          onChange={handleInputChange}
          placeholder="e.g., Groceries, Rent, Utilities"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        {formErrors.title && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.title}</p>}
      </div>

      <div>
        <label
          htmlFor="amount"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Amount ($)
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          value={formData.amount || ''}
          onChange={handleInputChange}
          placeholder="0.00"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        {formErrors.amount && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.amount}</p>}
      </div>

      <div>
        <label
          htmlFor="date"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          value={formData.date}
          onChange={handleInputChange}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Description (Optional)
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={3}
          placeholder="Add additional details about this expense..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      <div>
        <label
          htmlFor="splitType"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          How do you want to split this expense?
        </label>
        <select
          id="splitType"
          name="splitType"
          value={formData.splitType}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="EQUAL">Split equally</option>
          <option value="PERCENTAGE">Split by percentage</option>
          <option value="CUSTOM">Custom split</option>
        </select>
        {formErrors.splitType && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.splitType}</p>}
      </div>

      {/* Split details */}
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Split Details</h4>

        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
          <div className="grid grid-cols-3 gap-2 mb-2 font-medium text-sm text-gray-700 dark:text-gray-300">
            <div>Member</div>
            {/* Conditionally render Percentage column header */}
            <div className={formData.splitType === 'PERCENTAGE' ? '' : 'col-start-3'}>
                {formData.splitType === 'PERCENTAGE' ? 'Percentage' : ''}
            </div>
            <div className={formData.splitType === 'PERCENTAGE' ? '' : 'col-start-3'}>
                {formData.splitType === 'EQUAL' ? 'Amount (auto-calculated)' : 'Amount'}
            </div>

          </div>

          {members.map(member => (
            <div key={member.id} className="grid grid-cols-3 gap-2 mb-3 items-center">
              <div className="text-sm text-gray-800 dark:text-gray-200">
                {member.name} {member.id === formData.creatorId && '(Paid)'}
              </div>

              {/* Conditionally render Percentage input */}
                {formData.splitType === 'PERCENTAGE' && (
                    <div>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={splitPercentages[member.id] || 0}
                            onChange={(e) => handlePercentageChange(member.id, parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                        />
                    </div>
                )}

              <div className={formData.splitType !== 'PERCENTAGE' ? 'col-start-3' : ''}>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-gray-500 dark:text-gray-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={splitAmounts[member.id] || 0}
                    onChange={(e) => handleAmountChange(member.id, parseFloat(e.target.value) || 0)}
                    disabled={formData.splitType === 'EQUAL'}
                    className={`w-full px-2 py-1 pl-6 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white ${
                      formData.splitType === 'EQUAL' ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200 dark:border-gray-600 mt-2">
            <span className="text-gray-700 dark:text-gray-300">Total:</span>
            <span className={`text-gray-900 dark:text-white ${
                (formData.splitType === 'CUSTOM' && Math.abs(Object.values(splitAmounts).reduce((sum, amount) => sum + amount, 0) - formData.amount) > 0.01) ||
                (formData.splitType === 'PERCENTAGE' && Math.abs(Object.values(splitPercentages).reduce((sum, perc) => sum + perc, 0) - 100) > 0.1)
                 ? 'text-red-600 dark:text-red-400' : ''
            }`}>
              ${Object.values(splitAmounts).reduce((sum, amount) => sum + amount, 0).toFixed(2)}
              {formData.splitType === 'PERCENTAGE' &&
                ` (${Object.values(splitPercentages).reduce((sum, perc) => sum + perc, 0).toFixed(2)}%)`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6 gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : expense ? 'Update Expense' : 'Add Expense'}
        </button>
      </div>
    </form>
  );
}