// src/app/(dashboard)/expenses/page.tsx
'use client';

import { useState, useEffect } from 'react';
import ExpenseForm from '@/components/expenses/ExpenseForm'; // Assuming this component exists
import PaymentMatrix from '@/components/expenses/PaymentMatrix'; // Assuming this component exists

// Define types matching the props expected by ExpenseForm
interface Member {
  id: string;
  name: string;
  avatar?: string;
}

interface Payment {
  userId: string;
  userName: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'DECLINED';
}

interface Split {
  userId: string;
  userName: string;
  amount: number;
}

// --- FIX 1: Make id potentially undefined to match ExpenseForm expectations ---
interface Expense {
  id?: string; // Changed to optional to match ExpenseForm.tsx type
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


// Mock data using the updated Expense type
// Ensure creatorName is always provided
const MOCK_EXPENSES: Expense[] = [
  {
    id: '1',
    title: 'Groceries',
    amount: 85.75,
    date: new Date('2024-02-20T00:00:00.000Z'),
    creatorId: '1',
    creatorName: 'Jane Smith',
    description: 'Weekly groceries from Trader Joe\'s',
    splitType: 'EQUAL',
    householdId: '1',
    splits: [
      { userId: '1', userName: 'Jane Smith', amount: 21.44 },
      { userId: '2', userName: 'John Doe', amount: 21.44 },
      { userId: '3', userName: 'Emily Johnson', amount: 21.44 },
      { userId: '4', userName: 'Michael Brown', amount: 21.43 },
    ],
    payments: [
      { userId: '2', userName: 'John Doe', amount: 21.44, status: 'COMPLETED' },
      { userId: '3', userName: 'Emily Johnson', amount: 21.44, status: 'PENDING' },
      { userId: '4', userName: 'Michael Brown', amount: 21.43, status: 'PENDING' },
    ]
  },
  {
    id: '2',
    title: 'Internet Bill',
    amount: 89.99,
    date: new Date('2024-02-15T00:00:00.000Z'),
    creatorId: '3',
    creatorName: 'Emily Johnson',
    description: 'Monthly internet bill from Comcast',
    splitType: 'EQUAL',
    householdId: '1',
    splits: [ /* ... splits ... */ ],
    payments: [ /* ... payments ... */ ]
  },
  {
    id: '3',
    title: 'Pizza Night',
    amount: 45.50,
    date: new Date('2024-02-10T00:00:00.000Z'),
    creatorId: '2',
    creatorName: 'John Doe',
    description: 'Pizza and wings for movie night',
    splitType: 'EQUAL',
    householdId: '1',
    splits: [ /* ... splits ... */ ],
    payments: [ /* ... payments ... */ ]
  },
];

const MOCK_MEMBERS: Member[] = [
  { id: '1', name: 'Jane Smith', avatar: 'https://i.pravatar.cc/150?img=1' },
  { id: '2', name: 'John Doe', avatar: 'https://i.pravatar.cc/150?img=8' },
  { id: '3', name: 'Emily Johnson', avatar: 'https://i.pravatar.cc/150?img=5' },
  { id: '4', name: 'Michael Brown', avatar: 'https://i.pravatar.cc/150?img=12' },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>(MOCK_EXPENSES);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<Expense | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);

  useEffect(() => {
    calculateBalances();
  }, [expenses]);

  const calculateBalances = () => {
    // ... balance calculation ...
    const finalBalances: Record<string, Balance> = {};
     MOCK_MEMBERS.forEach(member => {
      finalBalances[member.id] = { userId: member.id, userName: member.name, owes: 0, isOwed: 0, net: 0 };
    });
    expenses.forEach(expense => {
        finalBalances[expense.creatorId].net += expense.amount;
        expense.splits.forEach(split => {
             finalBalances[split.userId].net -= split.amount;
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

  // Combined handler for form submission - Fixed to handle potentially undefined id
  const handleFormSubmit = (submittedExpenseData: Expense) => {
     console.log("Form submitted:", submittedExpenseData);

     // Find creator name if not provided by form
     const creatorName = submittedExpenseData.creatorName || 
                          MOCK_MEMBERS.find(m => m.id === submittedExpenseData.creatorId)?.name || 
                          "Unknown";

     if (currentExpense && submittedExpenseData.id) {
       // --- Update Logic ---
        const updatedExpense = {
         ...expenses.find(e => e.id === submittedExpenseData.id), // Get existing base
         ...submittedExpenseData, // Apply updates from form
         creatorName: creatorName, // Ensure creatorName is set
         date: new Date(submittedExpenseData.date) // Ensure date is Date object
       } as Expense;

       setExpenses(expenses.map(expense =>
         expense.id === updatedExpense.id ? updatedExpense : expense
       ));
       console.log("Updating expense:", updatedExpense.id);

     } else {
       // --- Add Logic ---
       const newId = submittedExpenseData.id || `mock-${Date.now()}`;
       const expenseToAdd: Expense = {
         ...submittedExpenseData,
         id: newId, // Set required ID
         creatorName: creatorName, // Set required creatorName
         date: new Date(submittedExpenseData.date),
         // Handle potentially undefined or empty arrays
         splits: submittedExpenseData.splits?.length > 0 ? submittedExpenseData.splits : 
                MOCK_MEMBERS.map(m => ({ 
                  userId: m.id, 
                  userName: m.name, 
                  amount: parseFloat((submittedExpenseData.amount / MOCK_MEMBERS.length).toFixed(2)) 
                })),
         payments: submittedExpenseData.payments?.length > 0 ? submittedExpenseData.payments : 
                  MOCK_MEMBERS.filter(m => m.id !== submittedExpenseData.creatorId)
                    .map(m => ({ 
                      userId: m.id, 
                      userName: m.name, 
                      amount: parseFloat((submittedExpenseData.amount / MOCK_MEMBERS.length).toFixed(2)), 
                      status: 'PENDING' as const 
                    }))
       };

       setExpenses([...expenses, expenseToAdd]);
       console.log("Adding expense:", expenseToAdd.id);
     }

     setShowExpenseForm(false);
     setCurrentExpense(null);
   };

  const handleEditExpense = (expense: Expense) => {
    setCurrentExpense(expense);
    setShowExpenseForm(true);
  };

  const handleDeleteExpense = (expenseId: string) => {
    setExpenses(expenses.filter(expense => expense.id !== expenseId));
    console.log("Deleting expense:", expenseId);
  };

  const handleMarkAsPaid = (expenseId: string, userId: string) => {
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
     console.log(`Marking payment as paid for user ${userId} in expense ${expenseId}`);
  };

  // Current user ID for display logic
  const currentUserId = '1'; // TODO: Replace with actual current user ID

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
         {/* ... title and button ... */}
         <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Household Expenses</h1>
         <button onClick={() => { setCurrentExpense(null); setShowExpenseForm(true); }} /* ... classes ... */>Add New Expense</button>
      </div>

      {/* Payment Summary */}
      <div className="mb-8">
         {/* ... title and commented out matrix ... */}
         <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Payment Summary</h2>
         {/* <PaymentMatrix balances={balances} /> */}
         <p className="text-sm text-gray-500 dark:text-gray-400">(Payment summary component temporarily disabled - requires prop definition)</p>
      </div>

      {/* Expenses List */}
      <div>
         {/* ... title and table ... */}
         <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Expenses</h2>
         <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
           <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              {/* Table Head */}
              <thead className="bg-gray-50 dark:bg-gray-700">
                 {/* ... headers ... */}
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
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{expense.creatorName}</td> {/* Uses required creatorName */}
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${userSplit ? userSplit.amount.toFixed(2) : '0.00'}</td>
                       <td className="px-6 py-4 whitespace-nowrap">{/* Status Badges */}
                          {isCreator ? (<span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">You Paid</span>
                          ) : isSettled ? (<span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Settled</span>
                          ) : needsToPay ? (<span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">You Owe</span>
                          ) : (<span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">-</span>)}
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">{/* Action Buttons */}
                          <div className="flex justify-end space-x-2">
                            {needsToPay && (<button onClick={() => handleMarkAsPaid(expense.id, currentUserId)} className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300" title="Mark your share as paid">Mark Paid</button>)}
                            <button onClick={() => handleEditExpense(expense)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">Edit</button>
                            <button onClick={() => handleDeleteExpense(expense.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                          </div>
                       </td>
                     </tr>
                   );
                 })}
              </tbody>
           </table>
         </div>
      </div>

      {/* Expense Form Modal */}
      {showExpenseForm && (
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
                    members={MOCK_MEMBERS}
                    onSubmit={handleFormSubmit}
                    onCancel={() => { setShowExpenseForm(false); setCurrentExpense(null); }}
                    householdId={'1'} // Pass mock household ID
                  />
              </div>
           </div>
         </div>
       )}
    </div>
  );
}