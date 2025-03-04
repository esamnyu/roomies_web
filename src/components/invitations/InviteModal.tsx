// src/components/invitations/InviteModal.tsx
'use client';

import { useState } from 'react';
import InvitationForm from './InvitationForm';
import PendingInvitations from './PendingInvitations';

interface InviteModalProps {
  householdId: string;
  onClose: () => void;
}

export default function InviteModal({
  householdId,
  onClose
}: InviteModalProps) {
  const [activeTab, setActiveTab] = useState<'invite' | 'pending'>('invite');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              className="bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={onClose}
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
              Manage Roommate Invitations
            </h3>
            <div className="mt-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Invite your roommates to join your household and manage pending invitations.
              </p>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="mt-4 border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('invite')}
                className={`${
                  activeTab === 'invite'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Send Invitation
              </button>
              
              <button
                onClick={() => setActiveTab('pending')}
                className={`${
                  activeTab === 'pending'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Pending Invitations
              </button>
            </nav>
          </div>
          
          {/* Tab content */}
          <div className="mt-4">
            {activeTab === 'invite' ? (
              <InvitationForm 
                householdId={householdId} 
                onInviteSent={() => {
                  handleRefresh();
                  setActiveTab('pending');
                }}
              />
            ) : (
              <PendingInvitations 
                householdId={householdId}
                onRefresh={handleRefresh}
                key={refreshTrigger} // Force refresh when triggered
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}