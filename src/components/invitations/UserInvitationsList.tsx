'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  householdId: string;
  household: {
    id: string;
    name: string;
    address?: string;
  };
  inviter: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  createdAt: string;
  expiresAt: string;
}

export default function UserInvitationsList() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingIds, setProcessingIds] = useState<string[]>([]);
  
  // Fetch user's pending invitations
  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/invitations?status=PENDING');
        
        if (!response.ok) {
          throw new Error('Failed to fetch invitations');
        }
        
        const data = await response.json();
        setInvitations(data);
      } catch (err) {
        setError('Error loading invitations');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInvitations();
  }, []);
  
  const handleAction = async (id: string, action: 'accept' | 'decline') => {
    setProcessingIds(prev => [...prev, id]);
    
    try {
      const response = await fetch(`/api/invitations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: action === 'accept' ? 'ACCEPTED' : 'DECLINED' }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} invitation`);
      }
      
      // Remove from list or update status
      setInvitations(prev => prev.filter(inv => inv.id !== id));
      
      // If accepted, we might want to redirect to the household
      if (action === 'accept') {
        // Could redirect or show a success message
      }
    } catch (err) {
      setError(`Error ${action}ing invitation`);
      console.error(err);
    } finally {
      setProcessingIds(prev => prev.filter(pid => pid !== id));
    }
  };
  
  if (loading) {
    return <div>Loading your invitations...</div>;
  }
  
  if (error) {
    return <div className="text-red-500">{error}</div>;
  }
  
  if (invitations.length === 0) {
    return <div>You don't have any pending invitations.</div>;
  }
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Pending Invitations</h2>
      
      {invitations.map((invitation) => (
        <div 
          key={invitation.id} 
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-lg">
                Invitation to join {invitation.household.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                From: {invitation.inviter.name} ({invitation.inviter.email})
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Role: {invitation.role.charAt(0) + invitation.role.slice(1).toLowerCase()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sent: {formatDate(invitation.createdAt)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Expires: {formatDate(invitation.expiresAt)}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                isLoading={processingIds.includes(invitation.id)}
                disabled={processingIds.includes(invitation.id)}
                onClick={() => handleAction(invitation.id, 'decline')}
              >
                Decline
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={processingIds.includes(invitation.id)}
                disabled={processingIds.includes(invitation.id)}
                onClick={() => handleAction(invitation.id, 'accept')}
              >
                Accept
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}