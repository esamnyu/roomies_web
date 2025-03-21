'use client';

import { useState } from 'react';
import InviteModal from '@/components/invitations/InviteModal';
import Button from '@/components/ui/Button';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

interface HouseholdMembersProps {
  householdId: string;
  members: Member[];
  isAdmin: boolean;
}

export default function HouseholdMembers({ 
  householdId, 
  members, 
  isAdmin 
}: HouseholdMembersProps) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          Household Members ({members.length})
        </h2>
        
        {isAdmin && (
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => setShowInviteModal(true)}
          >
            Invite Member
          </Button>
        )}
      </div>
      
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {members.map((member) => (
          <li key={member.id} className="py-4 flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {member.avatar ? (
                  <img 
                    src={member.avatar} 
                    alt={member.name} 
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-300 text-sm font-medium">
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {member.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {member.email}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              <span className="px-2.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {member.role}
              </span>
            </div>
          </li>
        ))}
      </ul>
      
      {showInviteModal && (
        <InviteModal 
          householdId={householdId} 
          onClose={() => setShowInviteModal(false)} 
        />
      )}
    </div>
  );
}