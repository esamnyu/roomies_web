// src/components/dashboard/PendingInvitationsPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

// Define the interface for invitation objects
interface Invitation {
  role: any;
  id: string;
  token: string;
  email: string;
  status: string;
  message?: string;
  expiresAt: string;
  createdAt: string;
  inviter?: {
    id: string;
    name: string;
    email: string;
  };
  household?: {
    id: string;
    name: string;
    address?: string;
  };
}

export default function PendingInvitationsPanel() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching pending invitations...');
        const response = await fetch('/api/invitations?status=PENDING');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch invitations: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Invitations data:', data);
        setInvitations(data);
      } catch (error) {
        console.error('Error fetching invitations:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitations();
  }, []);

  const handleAccept = async (token: string) => {
    try {
      const response = await fetch(`/api/invitations`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
      
      if (response.ok) {
        const data = await response.json();
        // Refresh invitations
        setInvitations(invitations.filter(inv => inv.token !== token));
        
        // Redirect to dashboard or chat
        if (data.redirectTo) {
          router.push(data.redirectTo);
        } else {
          router.push('/dashboard');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept invitation');
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setError(error instanceof Error ? error.message : 'Failed to accept invitation');
    }
  };
  
  const handleViewDetails = (token: string) => {
    router.push(`/invite?token=${token}`);
  };

  if (loading) {
    return (
      <Card title="Pending Invitations">
        <div className="flex justify-center items-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Pending Invitations">
        <div className="p-4 text-red-500 dark:text-red-400">
          Error loading invitations: {error}
        </div>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return null; // Don't show anything if there are no invitations
  }

  return (
    <Card title="Pending Invitations">
      <div className="space-y-4 p-2">
        {invitations.map((invitation) => (
          <div 
            key={invitation.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {invitation.inviter?.name || 'Someone'} invited you to join {invitation.household?.name || 'a household'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Role: {invitation.role?.charAt(0)?.toUpperCase() + invitation.role?.slice(1)?.toLowerCase() || 'Member'}
                </p>
                {invitation.message && (
                  <p className="text-sm italic mt-2 text-gray-600 dark:text-gray-400">
                    "{invitation.message}"
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleAccept(invitation.token)}
                >
                  Accept
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDetails(invitation.token)}
                >
                  Details
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}