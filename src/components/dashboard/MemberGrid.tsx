// src/components/dashboard/MemberGrid.tsx
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabaseClient } from '@/lib/supabase';

interface Member {
  id: string;
  name: string;
  avatar: string;
  role: 'ADMIN' | 'MEMBER' | 'GUEST';
  status: 'ONLINE' | 'AWAY' | 'OFFLINE';
  joined_at: string;
  owes?: number;
  isOwed?: number;
  tasksCompleted?: number;
  tasksPending?: number;
}

interface MemberGridProps {
  householdId: string;
  onInvite?: () => void;
}

export default function MemberGrid({ householdId, onInvite }: MemberGridProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'ONLINE' | 'AWAY'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchMembers();
  }, [householdId]);
  
  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/households/${householdId}/members`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch household members');
      }
      
      const data = await response.json();
      setMembers(data);
    } catch (err) {
      console.error('Error fetching members:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching members');
    } finally {
      setLoading(false);
    }
  };
  
  // Get current user's ID for UI enhancements
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
      }
    };
    
    getCurrentUser();
  }, []);
  
  const filteredMembers = activeTab === 'ALL' 
    ? members 
    : members.filter(member => member.status === activeTab);

  const getRoleColor = (role: Member['role']) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'MEMBER':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'GUEST':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: Member['status']) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-green-500';
      case 'AWAY':
        return 'bg-yellow-500';
      case 'OFFLINE':
        return 'bg-gray-500';
    }
  };
  
  const handleMessageMember = async (memberId: string) => {
    try {
      // Implementation would depend on your chat system
      console.log(`Opening chat with member: ${memberId}`);
      // Navigate to chat or open chat modal
    } catch (err) {
      console.error('Error starting chat:', err);
    }
  };
  
  const handleMemberOptions = (memberId: string) => {
    // This would open a dropdown or modal with member options
    console.log(`Show options for member: ${memberId}`);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="text-red-600 dark:text-red-400">
          Error: {error}
          <button 
            onClick={fetchMembers}
            className="ml-2 text-blue-600 dark:text-blue-400 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Household Members</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </p>
          </div>
          
          <button
            onClick={onInvite}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg 
              className="h-4 w-4 mr-1" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
              />
            </svg>
            Invite
          </button>
        </div>
        
        <div className="px-2">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`${
                activeTab === 'ALL'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } flex-1 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('ONLINE')}
              className={`${
                activeTab === 'ONLINE'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } flex-1 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
            >
              Online
            </button>
            <button
              onClick={() => setActiveTab('AWAY')}
              className={`${
                activeTab === 'AWAY'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } flex-1 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
            >
              Away
            </button>
          </nav>
        </div>
      </div>
      
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {filteredMembers.length > 0 ? (
          filteredMembers.map((member) => (
            <li key={member.id} className="px-6 py-4">
              <div className="flex items-center">
                <div className="relative flex-shrink-0">
                  <Image
                    className="h-12 w-12 rounded-full object-cover"
                    src={member.avatar}
                    alt={member.name}
                    width={48}
                    height={48}
                  />
                  <div 
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(member.status)}`}
                  />
                </div>
                
                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {member.name} {member.id === currentUserId && ' (You)'}
                      </h4>
                      <div className="flex items-center mt-1">
                        <span 
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}
                        >
                          {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          Joined {new Date(member.joined_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button 
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                        onClick={() => handleMessageMember(member.id)}
                        aria-label={`Message ${member.name}`}
                      >
                        <svg 
                          className="h-5 w-5" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24" 
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                          />
                        </svg>
                      </button>
                      <button 
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                        onClick={() => handleMemberOptions(member.id)}
                        aria-label={`More options for ${member.name}`}
                      >
                        <svg 
                          className="h-5 w-5" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24" 
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" 
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Financial</p>
                      <div className="flex space-x-4 mt-1">
                        <div className="text-red-600 dark:text-red-400">
                          Owes: ${member.owes?.toFixed(2) || '0.00'}
                        </div>
                        <div className="text-green-600 dark:text-green-400">
                          Owed: ${member.isOwed?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Tasks</p>
                      <div className="flex space-x-4 mt-1">
                        <div className="text-green-600 dark:text-green-400">
                          Done: {member.tasksCompleted || 0}
                        </div>
                        <div className="text-yellow-600 dark:text-yellow-400">
                          Pending: {member.tasksPending || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))
        ) : (
          <li className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
            No members found with the selected filter.
          </li>
        )}
      </ul>
    </div>
  );
}