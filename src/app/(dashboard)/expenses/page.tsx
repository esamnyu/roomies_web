// src/app/(dashboard)/expenses/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import PaymentMatrix from '@/components/expenses/PaymentMatrix';
import {
  fetchExpenses,
  fetchHouseholdMembers,
  createExpense,
  updateExpense,
  deleteExpense,
  updatePaymentStatus
} from '@/lib/services/expenseService';

// Define types matching the props expected by ExpenseForm
interface Member {
  id: string;
  name: string;
  avatar?: string;
}

interface Payment {
  id?: string; // Optional for new payments
  userId: string;
  userName: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'DECLINED';
  expenseId?: string; // Optional reference to parent expense
}

interface Split {
  id?: string; // Add optional id for backend reference
  userId: string;
  userName: string;
  amount: number;
  expenseId?: string; // Add optional reference to parent expense
}

interface Expense {
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

// Type for balance calculation
interface Balance {
  userId: string;
  userName: string;
  owes: number;
  isOwed: number;
  net: number;
}

export default function ExpensesPage() {
  const params = useParams();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [householdId, setHouseholdId] = useState<string | null>(params?.householdId as string || null);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<Expense | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get current user and their household from Supabase auth
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user?.id) {
        setCurrentUserId(session.user.id);

        // If no householdId from params, get user's primary household
        if (!householdId) {
          const { data: membership } = await supabaseClient
            .from('household_members')
            .select('household_id')
            .eq('user_id', session.user.id)
            .order('joined_at', { ascending: false })
            .limit(1)
            .single();

          if (membership?.household_id) {
            setHouseholdId(membership.household_id);
          }
        }
      }
    };
    getUser();
  }, [householdId]);

  // Fetch data when component mounts or householdId changes
  useEffect(() => {
    const loadData = async () => {
      if (!householdId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch expenses and members in parallel
        const [expensesData, membersData] = await Promise.all([
          fetchExpenses(householdId),
          fetchHouseholdMembers(householdId)
        ]);

        // Convert dates from strings to Date objects
        const formattedExpenses = expensesData.map((expense: any) => ({
          ...expense,
          date: new Date(expense.date)
        }));

        setExpenses(formattedExpenses);
        setMembers(membersData);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (householdId) {
      loadData();
    }
  }, [householdId]);

  // Calculate balances whenever expenses change
  useEffect(() => {
    calculateBalances();
  }, [expenses, members]);

  const calculateBalances = () => {
    if (!members.length) return;
    
    const finalBalances: Record<string, Balance> = {};
    
    members.forEach(member => {
      finalBalances[member.id] = { 
        userId: member.id, 
        userName: member.name, 
        owes: 0, 
        isOwed: 0, 
        net: 0 
      };
    });
    
    expenses.forEach(expense => {
      if (finalBalances[expense.creatorId]) {
        finalBalances[expense.creatorId].net += expense.amount;
      }
      
      expense.splits.forEach(split => {
        if (finalBalances[split.userId]) {
          finalBalances[split.userId].net -= split.amount;
        }
      });
    });
    
    Object.keys(finalBalances).forEach(userId => {
      finalBalances[userId].net = parseFloat(finalBalances[userId].net.toFixed(2));
      if (finalBalances[userId].net < 0) {
        finalBalances[userId].owes = Math.abs(finalBalances[userId].net);
        finalBalances[userId].isOwed = 0;
      } else {
        finalBalances[userId].isOwed = finalBalances[userId].net;
        finalBalances[userId].owes = 0;
      }
    });
    
    setBalances(Object.values(finalBalances));
  };

  // Handle form submission - now with API integration
  const handleFormSubmit = async (submittedExpenseData: Expense) => {
    try {
      // Find creator name if not provided by form
      const creatorName = submittedExpenseData.creatorName || 
                          members.find(m => m.id === submittedExpenseData.creatorId)?.name || 
                          "Unknown";

      // Prepare data with proper format for API
      const expenseData = {
        ...submittedExpenseData,
        creatorName,
        // Ensure date is sent in ISO format
        date: new Date(submittedExpenseData.date).toISOString(),
      };

      if (currentExpense && submittedExpenseData.id) {
        // Update existing expense
        const updatedExpense = await updateExpense(submittedExpenseData.id, expenseData);
        
        // Update local state
        setExpenses(expenses.map(expense =>
          expense.id === updatedExpense.id ? {
            ...updatedExpense,
            date: new Date(updatedExpense.date)
          } : expense
        ));
        
        console.log("Updated expense:", updatedExpense.id);
      } else {
        // Create new expense
        const newExpense = await createExpense(expenseData);
        
        // Add to local state
        setExpenses([...expenses, {
          ...newExpense,
          date: new Date(newExpense.date)
        }]);
        
        console.log("Added expense:", newExpense.id);
      }

      setShowExpenseForm(false);
      setCurrentExpense(null);
    } catch (err) {
      console.error('Error saving expense:', err);
      // You could set an error state and show to user
      alert('Failed to save expense. Please try again.');
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setCurrentExpense(expense);
    setShowExpenseForm(true);
  };

  const handleDeleteExpense = async (expenseId: string | undefined) => {
    if (!expenseId) return;
    
    try {
      await deleteExpense(expenseId);
      
      // Update local state
      setExpenses(expenses.filter(expense => expense.id !== expenseId));
      console.log("Deleted expense:", expenseId);
    } catch (err) {
      console.error('Error deleting expense:', err);
      alert('Failed to delete expense. Please try again.');
    }
  };

  const handleMarkAsPaid = async (expenseId: string | undefined, userId: string) => {
    if (!expenseId) return;
    
    try {
      // Find the payment that needs to be updated
      const expense = expenses.find(e => e.id === expenseId);
      if (!expense) return;
      
      const payment = expense.payments.find(p => p.userId === userId);
      if (!payment || !payment.id) return;
      
      // Update the payment status through API
      await updatePaymentStatus(payment.id, 'COMPLETED');
      
      // Update local state
      setExpenses(prevExpenses => prevExpenses.map(expense => {
        if (expense.id === expenseId) {
          return {
            ...expense,
            payments: expense.payments.map(payment =>
              payment.userId === userId ? { ...payment, status: 'COMPLETED' as const } : payment
            )
          };
        }
        return expense;
      }));
      
      console.log(`Marked payment as paid for user ${userId} in expense ${expenseId}`);
    } catch (err) {
      console.error('Error updating payment status:', err);
      alert('Failed to mark payment as paid. Please try again.');
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading expenses...</div>;
  
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
         <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Household Expenses</h1>
         <button 
           onClick={() => { setCurrentExpense(null); setShowExpenseForm(true); }}
           className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
         >
           Add New Expense
         </button>
      </div>

      {/* Payment Summary */}
      <div className="mb-8">
         <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Payment Summary</h2>
         {householdId && <PaymentMatrix householdId={householdId} />}
      </div>

      {/* Expenses List */}
      <div>
         <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Expenses</h2>
         {expenses.length > 0 ? (
           <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
             <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                {/* Table Head */}
                <thead className="bg-gray-50 dark:bg-gray-700">
                   <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Expense</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Paid By</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Your Share</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                   </tr>
                </thead>
                {/* Table Body */}
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                   {expenses.map((expense) => {
                     const isCreator = expense.creatorId === currentUserId;
                     const userSplit = expense.splits.find(split => split.userId === currentUserId);
                     const userPaymentEntry = expense.payments.find(payment => payment.userId === currentUserId);
                     const needsToPay = !isCreator && userPaymentEntry?.status === 'PENDING';
                     const isSettled = isCreator || userPaymentEntry?.status === 'COMPLETED';

                     return (
                       <tr key={expense.id}>
                         {/* Table Cells */}
                         <td className="px-6 py-4 whitespace-nowrap">
                           <div className="text-sm font-medium text-gray-900 dark:text-white">{expense.title}</div>
                           {expense.description && <div className="text-sm text-gray-500 dark:text-gray-400">{expense.description}</div>}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{expense.date.toLocaleDateString()}</td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${expense.amount.toFixed(2)}</td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{expense.creatorName}</td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${userSplit ? userSplit.amount.toFixed(2) : '0.00'}</td>
                         <td className="px-6 py-4 whitespace-nowrap">{/* Status Badges */}
                            {isCreator ? (<span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">You Paid</span>
                            ) : isSettled ? (<span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Settled</span>
                            ) : needsToPay ? (<span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">You Owe</span>
                            ) : (<span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">-</span>)}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">{/* Action Buttons */}
                            <div className="flex justify-end space-x-2">
                              {needsToPay && expense.id && currentUserId && (<button onClick={() => handleMarkAsPaid(expense.id!, currentUserId)} className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300" title="Mark your share as paid">Mark Paid</button>)}
                              <button onClick={() => handleEditExpense(expense)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">Edit</button>
                              {expense.id && <button onClick={() => handleDeleteExpense(expense.id!)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Delete</button>}
                            </div>
                         </td>
                       </tr>
                     );
                   })}
                </tbody>
             </table>
           </div>
         ) : (
           <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 text-center">
             <p className="text-gray-500 dark:text-gray-400">No expenses found. Add your first expense!</p>
           </div>
         )}
      </div>

      {/* Expense Form Modal */}
      {showExpenseForm && householdId && (
         <div className="fixed inset-0 z-50 overflow-y-auto">
           <div className="flex items-center justify-center min-h-screen px-4">
              {/* Background overlay */}
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowExpenseForm(false)} />
              {/* Modal panel */}
              <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6 shadow-xl transform transition-all sm:my-8">
                 {/* Modal Header */}
                 <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">{currentExpense ? 'Edit Expense' : 'Add New Expense'}</h3>
                    <button type="button" className="p-1 -m-1 rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" onClick={() => setShowExpenseForm(false)}>
                       <span className="sr-only">Close</span><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                 </div>
                 {/* Expense Form */}
                 <ExpenseForm
                    expense={currentExpense} 
                    members={members}
                    onSubmit={handleFormSubmit}
                    onCancel={() => { setShowExpenseForm(false); setCurrentExpense(null); }}
                    householdId={householdId}
                  />
              </div>
           </div>
         </div>
       )}
    </div>
  );
}