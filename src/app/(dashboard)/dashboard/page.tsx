// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useState } from 'react';
import HouseholdInfo from '@/components/dashboard/HouseholdInfo';
import MemberGrid from '@/components/dashboard/MemberGrid';
import Link from 'next/link';

// Mock data for demonstration
const MOCK_HOUSEHOLD = {
  name: '123 College Avenue',
  address: '123 College Avenue, Berkeley, CA 94704',
  moveInDate: 'August 15, 2023',
  memberCount: 4,
  pendingExpenses: 3,
  upcomingTasks: 5,
  unreadMessages: 2,
};

const MOCK_MEMBERS = [
  {
    id: '1',
    name: 'Jane Smith',
    avatar: 'https://i.pravatar.cc/150?img=1',
    role: 'ADMIN' as const,
    status: 'ONLINE' as const,
    joinedAt: '2023-08-15T00:00:00.000Z',
    owes: 0,
    isOwed: 120.50,
    tasksCompleted: 8,
    tasksPending: 2,
  },
  {
    id: '2',
    name: 'John Doe',
    avatar: 'https://i.pravatar.cc/150?img=8',
    role: 'MEMBER' as const,
    status: 'AWAY' as const,
    joinedAt: '2023-08-15T00:00:00.000Z',
    owes: 75.25,
    isOwed: 0,
    tasksCompleted: 5,
    tasksPending: 1,
  },
  {
    id: '3',
    name: 'Emily Johnson',
    avatar: 'https://i.pravatar.cc/150?img=5',
    role: 'MEMBER' as const,
    status: 'ONLINE' as const,
    joinedAt: '2023-08-15T00:00:00.000Z',
    owes: 45.00,
    isOwed: 30.75,
    tasksCompleted: 7,
    tasksPending: 0,
  },
  {
    id: '4',
    name: 'Michael Brown',
    avatar: 'https://i.pravatar.cc/150?img=12',
    role: 'MEMBER' as const,
    status: 'OFFLINE' as const,
    joinedAt: '2023-09-01T00:00:00.000Z',
    owes: 0,
    isOwed: 0,
    tasksCompleted: 3,
    tasksPending: 2,
  },
];

export default function DashboardPage() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviteMessage, setInviteMessage] = useState('');

  // In a real app, you would fetch this data from your API
  // For now, we'll use mock data

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would send the invitation to your API
    console.log('Inviting:', { email: inviteEmail, role: inviteRole, message: inviteMessage });
    // Close the modal and reset form
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteRole('MEMBER');
    setInviteMessage('');
  };

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-2/3">
          <HouseholdInfo
            name={MOCK_HOUSEHOLD.name}
            address={MOCK_HOUSEHOLD.address}
            moveInDate={MOCK_HOUSEHOLD.moveInDate}
            memberCount={MOCK_HOUSEHOLD.memberCount}
            pendingExpenses={MOCK_HOUSEHOLD.pendingExpenses}
            upcomingTasks={MOCK_HOUSEHOLD.upcomingTasks}
            unreadMessages={MOCK_HOUSEHOLD.unreadMessages}
          />
          
          {/* Quick Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Link 
              href="/expenses"
              className="flex items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-blue-50 dark:hover:bg-gray-700 transition"
            >
              <svg 
                className="w-5 h-5 text-blue-600 dark:text-blue-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <span className="font-medium text-gray-900 dark:text-white">Add Expense</span>
            </Link>
            
            <Link 
              href="/tasks"
              className="flex items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-green-50 dark:hover:bg-gray-700 transition"
            >
              <svg 
                className="w-5 h-5 text-green-600 dark:text-green-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" 
                />
              </svg>
              <span className="font-medium text-gray-900 dark:text-white">Create Task</span>
            </Link>
            
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-purple-50 dark:hover:bg-gray-700 transition"
            >
              <svg 
                className="w-5 h-5 text-purple-600 dark:text-purple-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" 
                />
              </svg>
              <span className="font-medium text-gray-900 dark:text-white">Invite Roommate</span>
            </button>
          </div>
        </div>
        
        <div className="w-full lg:w-1/3">
          {/* Upcoming Events or Calendar could go here */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Upcoming Events</h3>
            <div className="space-y-3">
              <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                <div className="flex-shrink-0 bg-red-100 dark:bg-red-800 rounded-md p-2">
                  <svg 
                    className="w-5 h-5 text-red-600 dark:text-red-300" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Rent Due</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tomorrow</p>
                </div>
              </div>
              
              <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-800 rounded-md p-2">
                  <svg 
                    className="w-5 h-5 text-blue-600 dark:text-blue-300" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">House Meeting</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Sunday, 7:00 PM</p>
                </div>
              </div>
              
              <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                <div className="flex-shrink-0 bg-green-100 dark:bg-green-800 rounded-md p-2">
                  <svg 
                    className="w-5 h-5 text-green-600 dark:text-green-300" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Trash Duty</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Monday (Your turn)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Members Grid */}
      <MemberGrid 
        members={MOCK_MEMBERS} 
        onInvite={() => setShowInviteModal(true)} 
      />

      {/* Invite Modal - This would be a proper component in a real app */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowInviteModal(false)} />
            
            <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={() => setShowInviteModal(false)}
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
                  Invite a Roommate
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Send an invitation to join your household. They'll receive an email with instructions.
                  </p>
                </div>
              </div>
              
              <form onSubmit={handleInviteSubmit} className="mt-5 space-y-4">
                <div>
                  <label 
                    htmlFor="email" 
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter their email"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                
                <div>
                  <label 
                    htmlFor="role" 
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Role
                  </label>
                  <select
                    id="role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                    <option value="GUEST">Guest</option>
                  </select>
                </div>
                
                <div>
                  <label 
                    htmlFor="message" 
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Personal Message (Optional)
                  </label>
                  <textarea
                    id="message"
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="Add a personal message..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                
                <div className="flex justify-end mt-6 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Send Invitation
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}