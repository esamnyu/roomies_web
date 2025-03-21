// src/components/dashboard/PendingInvitationsPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

// Define the interface for invitation objects
interface Invitation {
  id: string;
  token: string;
  email: string;
  status: string;
  message?: string;
  expiresAt: string;
  createdAt: string;
  householdId: string;
  inviterId: string;
  role: string;
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
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [processingToken, setProcessingToken] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const router = useRouter();

  // TEST MODE: Set to true to show all invitations regardless of email
  const TEST_MODE = true;

  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get current user info first
        const { data } = await supabaseClient.auth.getSession();
        const session = data.session;
        const userEmail = session?.user?.email || null;
        setCurrentUserEmail(userEmail);
        
        console.log('Current user email:', userEmail);
        
        // Direct query to get all pending invitations
        const { data: allInvitations, error: queryError } = await supabaseClient
          .from('Invitation')
          .select(`
            *,
            inviter:inviterId(id, name, email),
            household:householdId(id, name, address)
          `)
          .eq('status', 'PENDING');
        
        if (queryError) {
          console.error('Supabase query error:', queryError);
          throw queryError;
        }
        
        console.log('All pending invitations:', allInvitations);
        
        // Store debug info
        setDebugInfo({
          userEmail: userEmail || 'Not logged in',
          allInvitations: allInvitations || []
        });
        
        // In test mode, show all invitations
        // In normal mode, filter to only show invitations for current user
        if (TEST_MODE) {
          setInvitations(allInvitations || []);
        } else {
          setInvitations(
            allInvitations?.filter(inv => 
              userEmail && inv.email.toLowerCase() === userEmail.toLowerCase()
            ) || []
          );
        }
      } catch (error) {
        console.error('Error fetching invitations:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitations();
  }, []);

  const handleAccept = async (invitation: Invitation) => {
    try {
      setProcessingToken(invitation.token);
      console.log('Accepting invitation with token:', invitation.token);
      
      // First update the invitation status
      const { error: updateError } = await supabaseClient
        .from('Invitation')
        .update({
          status: 'ACCEPTED',
          updatedAt: new Date().toISOString(),
          respondedAt: new Date().toISOString()
        })
        .eq('id', invitation.id);
        
      if (updateError) {
        throw updateError;
      }
      
      // Then add user to the household
      const { data: sessionData } = await supabaseClient.auth.getSession();
      if (!sessionData.session?.user?.id) {
        throw new Error('User not authenticated');
      }
      
      const userId = sessionData.session.user.id;
      const membershipId = crypto.randomUUID();
      
      const { error: membershipError } = await supabaseClient
        .from('HouseholdUser')
        .insert({
          id: membershipId,
          userId: userId,
          householdId: invitation.householdId,
          role: invitation.role,
          joinedAt: new Date().toISOString()
        });
        
      if (membershipError) {
        throw membershipError;
      }
      
      // Success!
      setInvitations(invitations.filter(inv => inv.id !== invitation.id));
      alert(`You've successfully joined ${invitation.household?.name || 'the household'}!`);
      
      // Redirect to chat
      router.push('/chat');
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setError(error instanceof Error ? error.message : 'Failed to accept invitation');
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessingToken(null);
    }
  };
  
  const handleViewDetails = (token: string) => {
    router.push(`/invite?token=${token}`);
  };

  // Debug panel - remove in production
  const renderDebugPanel = () => {
    if (!debugInfo) return null;
    
    return (
      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-md text-xs">
        <h4 className="font-bold mb-1">Debug Info:</h4>
        <p>Your email: {debugInfo.userEmail}</p>
        <p>Invitations found: {debugInfo.allInvitations.length}</p>
        {TEST_MODE && (
          <p className="text-red-500 font-bold">TEST MODE ENABLED - Showing all invitations</p>
        )}
        <details>
          <summary>Show details</summary>
          <pre className="mt-2 overflow-auto max-h-40">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </details>
      </div>
    );
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
          <p>Error loading invitations: {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 text-blue-500 dark:text-blue-400 underline"
          >
            Refresh
          </button>
        </div>
        {renderDebugPanel()}
      </Card>
    );
  }

  if (invitations.length === 0) {
    return (
      <Card title="Pending Invitations">
        <div className="p-4 text-gray-500">
          No pending invitations found.
          {renderDebugPanel()}
        </div>
      </Card>
    );
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
                  Sent to: {invitation.email}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
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
                  onClick={() => handleAccept(invitation)}
                  isLoading={processingToken === invitation.token}
                  disabled={processingToken !== null}
                >
                  Accept
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDetails(invitation.token)}
                  disabled={processingToken !== null}
                >
                  Details
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {renderDebugPanel()}
    </Card>
  );
}