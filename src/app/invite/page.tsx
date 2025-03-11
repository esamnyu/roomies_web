// src/app/invite/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase';
import Button from '@/components/ui/Button';

interface HouseholdInfo {
  id: string;
  name: string;
  address?: string;
}

interface InviterInfo {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface InvitationDetails {
  id: string;
  email: string;
  role: string;
  message?: string;
  expiresAt: string;
  createdAt: string;
  household: HouseholdInfo;
  inviter: InviterInfo;
}

export default function InvitationPage() {
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingAction, setProcessingAction] = useState(false);
  const [userSession, setUserSession] = useState<any>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [showClaimConfirmation, setShowClaimConfirmation] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  // Load the user session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      setUserSession(session);
    };
    
    checkSession();
  }, []);
  
  // Fetch the invitation details when component mounts
  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setError('Invalid invitation link');
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/invitations/${token}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load invitation');
        }
        
        setInvitation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };
    
    fetchInvitation();
  }, [token]);
  
  const handleAcceptInvitation = async () => {
    if (!token) return;
    
    setProcessingAction(true);
    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'accept' }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401 && data.requiresAuth) {
          // User needs to sign in
          setNeedsSignIn(true);
          return;
        }
        
        throw new Error(data.error || 'Failed to accept invitation');
      }
      
      // Redirect to chat page regardless of what redirectTo says
      router.push('/chat');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleClaimInvitation = async () => {
    if (!token) return;
    
    setProcessingAction(true);
    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'accept',
          claimWithCurrentEmail: true 
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }
      
      // Redirect to chat page
      router.push('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessingAction(false);
      setShowClaimConfirmation(false);
    }
  };
  
  const handleDeclineInvitation = async () => {
    if (!token) return;
    
    if (!confirm('Are you sure you want to decline this invitation?')) {
      return;
    }
    
    setProcessingAction(true);
    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'decline' }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to decline invitation');
      }
      
      // Show a success message
      alert('Invitation declined successfully');
      
      // Redirect to the home page
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessingAction(false);
    }
  };
  
  // If we need the user to sign in first
  if (needsSignIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-md">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Sign in Required</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              You need to sign in to accept this invitation.
            </p>
            {invitation?.email && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Please sign in with <span className="font-medium">{invitation.email}</span>
              </p>
            )}
          </div>
          
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(`/invite?token=${token}`)}`}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Sign In
            </Link>
            
            <Link
              href={`/register?email=${invitation?.email || ''}&callbackUrl=${encodeURIComponent(`/invite?token=${token}`)}`}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Create Account
            </Link>
            
            <button
              onClick={() => setNeedsSignIn(false)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Go back to invitation
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
              <svg className="h-6 w-6 text-red-600 dark:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="mt-3 text-xl font-medium text-gray-900 dark:text-white">Invitation Error</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">{error}</p>
          </div>
          <div className="mt-5 text-center">
            <Link
              href="/"
              className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-md">
          <div className="text-center">
            <h2 className="text-xl font-medium text-gray-900 dark:text-white">Invitation Not Found</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              This invitation may have expired or been revoked.
            </p>
          </div>
          <div className="mt-5 text-center">
            <Link
              href="/"
              className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  // Check if user's email matches the invitation email
  const emailMismatch = userSession && userSession.user.email !== invitation.email;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">Roomies</h1>
          <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">
            You've been invited to join a household
          </h2>
        </div>
        
        <div className="mt-8">
          <div className="bg-gray-50 dark:bg-gray-700 p-5 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-shrink-0">
                {invitation.inviter.avatar ? (
                  <Image
                    src={invitation.inviter.avatar}
                    alt={invitation.inviter.name}
                    width={64}
                    height={64}
                    className="rounded-full"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xl font-medium text-blue-700 dark:text-blue-300">
                    {invitation.inviter.name.charAt(0)}
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {invitation.inviter.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">{invitation.inviter.email}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                  has invited you to join
                </p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {invitation.household.name}
              </h3>
              
              {invitation.household.address && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {invitation.household.address}
                </p>
              )}
              
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">
                Role: <span className="font-medium">{invitation.role.charAt(0) + invitation.role.slice(1).toLowerCase()}</span>
              </p>
            </div>
            
            {invitation.message && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Message:</h4>
                <div className="mt-1 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 italic">
                  "{invitation.message}"
                </div>
              </div>
            )}
          </div>
          
          {emailMismatch && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-md">
              <p className="text-sm">
                <strong>Note:</strong> You're currently signed in as {userSession.user.email}, 
                but this invitation was sent to {invitation.email}.
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={async () => {
                    await supabaseClient.auth.signOut();
                    window.location.reload();
                  }}
                  className="text-sm text-yellow-800 dark:text-yellow-200 underline"
                >
                  Sign out
                </button>
                <button
                  onClick={() => setShowClaimConfirmation(true)}
                  className="px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Use current account
                </button>
              </div>
            </div>
          )}
          
          <div className="mt-6 flex gap-4">
            <Button
              variant="outline"
              fullWidth
              onClick={handleDeclineInvitation}
              disabled={processingAction || (emailMismatch && !showClaimConfirmation)}
            >
              Decline
            </Button>
            
            <Button
              variant="primary"
              fullWidth
              onClick={handleAcceptInvitation}
              isLoading={processingAction}
              disabled={processingAction || (emailMismatch && !showClaimConfirmation)}
            >
              Accept
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showClaimConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Link invitation to your account?</h3>
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              This will accept the invitation sent to <strong>{invitation.email}</strong> and 
              link it to your current account <strong>{userSession.user.email}</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClaimConfirmation(false)}
                className="px-3 py-2 border border-gray-300 rounded text-gray-700 dark:text-gray-300 dark:border-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleClaimInvitation}
                className="px-3 py-2 bg-blue-600 text-white rounded"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}