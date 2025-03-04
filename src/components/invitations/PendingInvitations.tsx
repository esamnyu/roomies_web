// src/components/invitations/PendingInvitations.tsx
'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  message?: string;
  expiresAt: string;
  createdAt: string;
  inviter?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

interface PendingInvitationsProps {
  householdId: string;
  onRefresh?: () => void;
}

export default function PendingInvitations({ 
  householdId,
  onRefresh
}: PendingInvitationsProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isResending, setIsResending] = useState<Record<string, boolean>>({});
  const [isCanceling, setIsCanceling] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchInvitations();
  }, [householdId]);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/invitations?householdId=${householdId}&status=PENDING`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch invitations');
      }
      
      const data = await response.json();
      setInvitations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      setIsResending(prev => ({ ...prev, [invitationId]: true }));
      
      // In a real implementation, you would have an API endpoint to resend
      // For now, we'll just simulate it with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh the list
      await fetchInvitations();
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
    } finally {
      setIsResending(prev => ({ ...prev, [invitationId]: false }));
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }
    
    try {
      setIsCanceling(prev => ({ ...prev, [invitationId]: true }));
      
      // In a real implementation, you would have an API endpoint to cancel
      // For now, we'll just remove it from the list
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invitation');
    } finally {
      setIsCanceling(prev => ({ ...prev, [invitationId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="py-4 text-center text-gray-500 dark:text-gray-400">
        Loading invitations...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md">
        Error: {error}
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="py-4 text-center text-gray-500 dark:text-gray-400">
        No pending invitations
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {invitations.map(invitation => (
        <div 
          key={invitation.id} 
          className="p-4 bg-white dark:bg-gray-800 rounded-md shadow border border-gray-200 dark:border-gray-700"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center">
                <h3 className="font-medium text-gray-900 dark:text-white">{invitation.email}</h3>
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  Pending
                </span>
              </div>
              
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                <p>Role: {invitation.role.charAt(0) + invitation.role.slice(1).toLowerCase()}</p>
                <p>Sent: {formatDate(invitation.createdAt, true)}</p>
                <p>Expires: {formatDate(invitation.expiresAt)}</p>
              </div>
              
              {invitation.message && (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm italic text-gray-600 dark:text-gray-300">
                  "{invitation.message}"
                </div>
              )}
            </div>
            
            <div className="flex sm:flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                isLoading={isResending[invitation.id]}
                disabled={isResending[invitation.id] || isCanceling[invitation.id]}
                onClick={() => handleResendInvitation(invitation.id)}
              >
                Resend
              </Button>
              
              <Button
                size="sm"
                variant="danger"
                isLoading={isCanceling[invitation.id]}
                disabled={isResending[invitation.id] || isCanceling[invitation.id]}
                onClick={() => handleCancelInvitation(invitation.id)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}