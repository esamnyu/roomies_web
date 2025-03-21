'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HouseholdMembers from '@/components/dashboard/HouseholdMembers';
import { useAuth } from '@/context/AuthContext';

export default function MembersPage({ params }: { params: { householdId: string } }) {
  const { householdId } = params;
  const { user } = useAuth();
  const router = useRouter();
  
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');
  
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/households/${householdId}/members`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch members');
        }
        
        const data = await response.json();
        setMembers(data);
        
        // Find current user's role
        const currentUser = data.find((member: any) => member.userId === user?.id);
        if (currentUser) {
          setUserRole(currentUser.role);
        }
      } catch (err) {
        setError('Error loading household members');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    if (householdId && user) {
      fetchMembers();
    }
  }, [householdId, user]);
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (error) {
    return <div>{error}</div>;
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