// src/app/(dashboard)/expenses/page.tsx
'use client';

import { useState, useEffect } from 'react';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import PaymentMatrix from '@/components/expenses/PaymentMatrix';

// Mock data for demonstration
const MOCK_EXPENSES = [
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
    splits: [
      { userId: '1', userName: 'Jane Smith', amount: 22.50 },
      { userId: '2', userName: 'John Doe', amount: 22.50 },
      { userId: '3', userName: 'Emily Johnson', amount: 22.50 },
      { userId: '4', userName: 'Michael Brown', amount: 22.49 },
    ],
    payments: [
      { userId: '1', userName: 'Jane Smith', amount: 22.50, status: 'COMPLETED' },
      { userId: '2', userName: 'John Doe', amount: 22.50, status: 'COMPLETED' },
      { userId: '4', userName: 'Michael Brown', amount: 22.49, status: 'PENDING' },
    ]
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
    splits: [
      { userId: '1', userName: 'Jane Smith', amount: 11.38 },
      { userId: '2', userName: 'John Doe', amount: 11.38 },
      { userId: '3', userName: 'Emily Johnson', amount: 11.38 },
      { userId: '4', userName: 'Michael Brown', amount: 11.36 },
    ],
    payments: [
      { userId: '1', userName: 'Jane Smith', amount: 11.38, status: 'COMPLETED' },
      { userId: '3', userName: 'Emily Johnson', amount: 11.38, status: 'COMPLETED' },
      { userId: '4', userName: 'Michael Brown', amount: 11.36, status: 'COMPLETED' },
    ]
  },
];

const MOCK_MEMBERS = [
  {
    id: '1',
    name: 'Jane Smith',
    avatar: 'https://i.pravatar.cc/150?img=1',
  },
  {
    id: '2',
    name: 'John Doe',
    avatar: 'https://i.pravatar.cc/150?img=8',
  },
  {
    id: '3',
    name: 'Emily Johnson',
    avatar: 'https://i.pravatar.cc/150?img=5',
  },
  {
    id: '4',
    name: 'Michael Brown',
    avatar: 'https://i.pravatar.cc/150?img=12',
  },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState(MOCK_EXPENSES);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<any>(null);
  const [balances, setBalances] = useState<any[]>([]);
  
  // Calculate balances for payment matrix
  useEffect(() => {
    calculateBalances();
  }, [expenses]);
  
  const calculateBalances = () => {
    const tempBalances: Record<string, {userId: string, userName: string, owes: number, isOwed: number, net: number}> = {};
    
    // Initialize balances for all members
    MOCK_MEMBERS.forEach(member => {
      tempBalances[member.id] = {
        userId: member.id,
        userName: member.name,
        owes: 0,
        isOwed: 0,
        net: 0
      };
    });
    
    // Calculate owes and owed amounts
    expenses.forEach(expense => {
      // Add amount owed to creator
      if (tempBalances[expense.creatorId]) {
        tempBalances[expense.creatorId].isOwed += expense.amount;
      }
      
      // Process payments
      expense.payments.forEach(payment => {
        if (payment.status === 'COMPLETED') {
          // Reduce amount owed by payer
          if (tempBalances[payment.userId]) {
            tempBalances[payment.userId].owes -= payment.amount;
          }
          
          // Reduce amount owed to creator
          if (tempBalances[expense.creatorId]) {
            tempBalances[expense.creatorId].isOwed -= payment.amount;
          }
        }
      });
      
      // Process splits to determine who owes what
      expense.splits.forEach(split => {
        // Skip creator's own split
        if (split.userId !== expense.creatorId) {
          // If payment not completed, add to owes
          const paymentCompleted = expense.payments.some(
            p => p.userId === split.userId && p.status === 'COMPLETED'
          );
          
          if (!paymentCompleted && tempBalances[split.userId]) {
            tempBalances[split.userId].owes += split.amount;
          }
        }
      });
    });
    
    // Calculate net balance
    Object.keys(tempBalances).forEach(userId => {
      tempBalances[userId].net = tempBalances[userId].isOwed - tempBalances[userId].owes;
    });
    
    setBalances(Object.values(tempBalances));
  };
  
  const handleAddExpense = (newExpense: any) => {
    // Generate a simple ID - in a real app this would come from the backend
    const id = (expenses.length + 1).toString();
    
    // In a real app, you would send this data to your API
    const expenseToAdd = {
      ...newExpense,
      id,
      date: new Date(newExpense.date),
    };
    
    setExpenses([...expenses, expenseToAdd]);
    setShowExpenseForm(false);
    setCurrentExpense(null);
  };
  
  const handleEditExpense = (expense: any) => {
    setCurrentExpense(expense);
    setShowExpenseForm(true);
  };
  
  const handleUpdateExpense = (updatedExpense: any) => {
    // In a real app, you would send this data to your API
    const updatedExpenses = expenses.map(expense => 
      expense.id === updatedExpense.id ? updatedExpense : expense
    );
    
    setExpenses(updatedExpenses);
    setShowExpenseForm(false);
    setCurrentExpense(null);
  };
  
  const handleDeleteExpense = (expenseId: string) => {
    // In a real app, you would send this request to your API
    const filteredExpenses = expenses.filter(expense => expense.id !== expenseId);
    setExpenses(filteredExpenses);
  };
  
  const handleMarkAsPaid = (expenseId: string, userId: string) => {
    // In a real app, you would send this request to your API
    const updatedExpenses = expenses.map(expense => {
      if (expense.id === expenseId) {
        const updatedPayments = expense.payments.map(payment => {
          if (payment.userId === userId) {
            return { ...payment, status: 'COMPLETED' };
          }
          return payment;
        });
        
        return { ...expense, payments: updatedPayments };
      }
      return expense;
    });
    
    setExpenses(updatedExpenses);
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Household Expenses</h1>
        <button
          onClick={() => {
            setCurrentExpense(null);
            setShowExpenseForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Add New Expense
        </button>
      </div>
      
      {/* Payment Matrix showing who owes whom */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Payment Summary</h2>
        <PaymentMatrix balances={balances} />
      </div>
      
      {/* List of Expenses */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Expenses</h2>
        
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Expense
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Paid By
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Your Share
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {expenses.map((expense) => {
                // For demo purposes, assuming current user is user1
                const currentUserId = '1';
                const isCreator = expense.creatorId === currentUserId;
                const userSplit = expense.splits.find(split => split.userId === currentUserId);
                const userPayment = expense.payments.find(payment => payment.userId === currentUserId);
                const isPaid = isCreator || (userPayment && userPayment.status === 'COMPLETED');
                
                return (
                  <tr key={expense.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{expense.title}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{expense.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {expense.date.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${expense.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {expense.creatorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${userSplit ? userSplit.amount.toFixed(2) : '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isCreator ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Paid By You
                        </span>
                      ) : isPaid ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Paid
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {!isCreator && !isPaid && (
                          <button
                            onClick={() => handleMarkAsPaid(expense.id, currentUserId)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          >
                            Mark Paid
                          </button>
                        )}
                        <button
                          onClick={() => handleEditExpense(expense)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
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
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowExpenseForm(false)} />
            
            <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6 shadow-xl">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={() => setShowExpenseForm(false)}
                >
                  <span className="sr-only">Close</span>
                  <svg 
                    className="h-6 w-6" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    aria-hidden="true"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth="2" 
                      d="M6 18L18 6M6 6l12 12" 
                    />
                  </svg>
                </button>
              </div>
              
              <div className="mt-3 text-center sm:mt-0 sm:text-left">
                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                  {currentExpense ? 'Edit Expense' : 'Add New Expense'}
                </h3>
              </div>
              
              <ExpenseForm
                expense={currentExpense}
                members={MOCK_MEMBERS}
                onSubmit={currentExpense ? handleUpdateExpense : handleAddExpense}
                onCancel={() => {
                  setShowExpenseForm(false);
                  setCurrentExpense(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}