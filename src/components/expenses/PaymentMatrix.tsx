// src/components/expenses/PaymentMatrix.tsx
'use client';

import { useState } from 'react';

interface Balance {
  userId: string;
  userName: string;
  owes: number;
  isOwed: number;
  net: number;
}

interface PaymentMatrixProps {
  balances: Balance[];
}

export default function PaymentMatrix({ balances }: PaymentMatrixProps) {
  const [view, setView] = useState<'summary' | 'detail'>('summary');
  
  // Calculate total amounts
  const totalOwed = balances.reduce((sum, balance) => sum + balance.isOwed, 0);
  const totalOwes = balances.reduce((sum, balance) => sum + balance.owes, 0);
  
  // Sort balances by net amount (descending)
  const sortedBalances = [...balances].sort((a, b) => b.net - a.net);
  
  // Calculate optimal payments
  const calculateOptimalPayments = () => {
    // Deep copy of the balances to work with
    const workingBalances = sortedBalances.map(b => ({ ...b }));
    const payments: { from: string, fromName: string, to: string, toName: string, amount: number }[] = [];
    
    // Continue until all balances are settled (within a small epsilon for floating point errors)
    const epsilon = 0.01; // $0.01 precision
    
    while (true) {
      // Find largest debtor (negative net balance)
      const debtor = workingBalances.filter(b => b.net < -epsilon).sort((a, b) => a.net - b.net)[0];
      
      // Find largest creditor (positive net balance)
      const creditor = workingBalances.filter(b => b.net > epsilon).sort((a, b) => b.net - a.net)[0];
      
      // If we can't find either, we're done
      if (!debtor || !creditor) break;
      
      // Calculate payment amount (minimum of the two absolute values)
      const amount = Math.min(Math.abs(debtor.net), creditor.net);
      
      // Record the payment
      payments.push({
        from: debtor.userId,
        fromName: debtor.userName,
        to: creditor.userId,
        toName: creditor.userName,
        amount: parseFloat(amount.toFixed(2)) // Round to 2 decimal places
      });
      
      // Update balances
      debtor.net += amount;
      creditor.net -= amount;
    }
    
    return payments;
  };
  
  const optimalPayments = calculateOptimalPayments();

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Payment Summary
          </h3>
          
          <div className="flex">
            <button
              onClick={() => setView('summary')}
              className={`px-3 py-1 text-sm font-medium rounded-l-md ${
                view === 'summary'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setView('detail')}
              className={`px-3 py-1 text-sm font-medium rounded-r-md ${
                view === 'detail'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Payment Plan
            </button>
          </div>
        </div>
      </div>
      
      {view === 'summary' ? (
        <div className="px-4 py-5 sm:p-6">
          <div className="grid md:grid-cols-3 gap-6">
            {balances.map((balance) => (
              <div 
                key={balance.userId} 
                className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md shadow-sm"
              >
                <div className="font-medium text-gray-900 dark:text-white mb-2">
                  {balance.userName}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Total paid:</span>
                    <span className="text-gray-900 dark:text-white">${balance.isOwed.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Total owed:</span>
                    <span className="text-gray-900 dark:text-white">${balance.owes.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-600 my-1 pt-1"></div>
                  <div className="flex justify-between text-sm font-medium">
                    <span>Balance:</span>
                    <span 
                      className={
                        balance.net > 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : balance.net < 0 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-gray-600 dark:text-gray-400'
                      }
                    >
                      {balance.net > 0 ? '+' : ''}{balance.net.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center">
            <p>Total money exchanged in all expenses: ${totalOwed.toFixed(2)}</p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-5 sm:p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            To settle all balances, the following payments should be made:
          </p>
          
          {optimalPayments.length > 0 ? (
            <ul className="space-y-2">
              {optimalPayments.map((payment, index) => (
                <li 
                  key={index}
                  className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <span className="font-medium text-gray-900 dark:text-white">{payment.fromName}</span>
                    <svg 
                      className="h-5 w-5 mx-2 text-gray-400" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M14 5l7 7m0 0l-7 7m7-7H3" 
                      />
                    </svg>
                    <span className="font-medium text-gray-900 dark:text-white">{payment.toName}</span>
                  </div>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    ${payment.amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-700 dark:text-gray-300">
              All balances are settled. No payments needed.
            </p>
          )}
          
          <div className="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center">
            <p>This payment plan simplifies the settlement process with the minimum number of transactions.</p>
          </div>
        </div>
      )}
    </div>
  );
}