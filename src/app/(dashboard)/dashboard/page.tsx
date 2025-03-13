// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import HouseholdInfo from '@/components/dashboard/HouseholdInfo';
import MemberGrid from '@/components/dashboard/MemberGrid';
import PendingInvitationsPanel from '@/components/dashboard/PendingInvitationsPanel';
import Link from 'next/link';
import InviteModal from '@/components/invitations/InviteModal';
import { supabaseClient } from '@/lib/supabase';

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
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);
  const [currentHouseholdId, setCurrentHouseholdId] = useState('');

// Add this useEffect immediately after the useState declarations
useEffect(() => {
  const fetchUserHousehold = async () => {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (session) {
        // Get the user's primary household
        const { data: householdUser, error } = await supabaseClient
          .from('HouseholdUser')
          .select('householdId')
          .eq('userId', session.user.id)
          .order('joinedAt', { ascending: false })
          .limit(1)
          .single();
        
        if (!error && householdUser) {
          setCurrentHouseholdId(householdUser.householdId);
        }
      }
    } catch (error) {
      console.error('Error fetching household:', error);
    }
  };

  fetchUserHousehold();
}, []);
  
  const searchParams = useSearchParams();
  
  // Check if user just verified their account
  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      setShowWelcomeMessage(true);
      
      // Auto-hide the welcome message after 8 seconds
      const timer = setTimeout(() => {
        setShowWelcomeMessage(false);
      }, 8000);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

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
      {/* Verification Welcome Message */}
      {showWelcomeMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900 rounded-lg border border-green-200 dark:border-green-800 shadow-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-green-800 dark:text-green-200">
                Welcome to Roomies!
              </h3>
              <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                <p>Your account has been successfully verified. You can now enjoy all the features of our app.</p>
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <button
                    type="button"
                    onClick={() => setShowWelcomeMessage(false)}
                    className="ml-auto bg-green-50 dark:bg-green-900 px-2 py-1.5 rounded-md text-sm font-medium text-green-800 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Invitations Panel */}
      <div className="mb-6">
        <PendingInvitationsPanel />
      </div>

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

      {/* Invite Modal - Using the new component */}
      {showInviteModal && (
        <InviteModal 
          householdId={currentHouseholdId}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
}