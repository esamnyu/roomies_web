'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HouseholdMembers from '@/components/dashboard/HouseholdMembers';
import { useAuth } from '@/context/AuthContext';

export default function MembersPage({ params }: { params: { householdId: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  
  // Extract and validate household ID
  const householdId = params?.householdId;
  
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    // Validate householdId - ensure it's not undefined, null, or 'undefined'
    if (!householdId || householdId === 'undefined') {
      setError('Invalid household ID');
      setLoading(false);
      return;
    }

    // Ensure user is authenticated
    if (!user || !user.id) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    const fetchMembers = async () => {
      try {
        setLoading(true);
        
        console.log(`Fetching members for household: ${householdId}`);
        const response = await fetch(`/api/households/${householdId}/members`);
        
        // Handle HTTP error responses
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const statusCode = response.status;
          
          if (statusCode === 401) {
            console.error('Authentication error fetching members');
            setError('You need to be logged in to view household members');
            // Optionally redirect to login
            // router.push('/login');
            return;
          } else if (statusCode === 403) {
            setError('You do not have permission to view this household');
            return;
          } else {
            throw new Error(errorData.error || 'Failed to fetch members');
          }
        }
        
        const data = await response.json();
        setMembers(data);
        
        // Find current user's role
        const currentUser = data.find((member: any) => member.userId === user?.id);
        if (currentUser) {
          setUserRole(currentUser.role);
        } else {
          // User is not a member of this household
          console.warn('Current user not found in member list');
        }
      } catch (err) {
        console.error('Error fetching household members:', err);
        setError('Error loading household members. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [householdId, user, router]);

  // Enhanced loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Better error display
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button 
                onClick={() => router.refresh()}
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
              >
                Refresh page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = userRole === 'ADMIN';

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Household Members</h1>
      
      <HouseholdMembers 
        householdId={householdId}
        members={members}
        isAdmin={isAdmin}
      />
    </div>
  );
}