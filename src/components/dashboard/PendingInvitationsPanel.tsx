// src/components/dashboard/PendingInvitationsPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

// Define the interface for invitation objects
interface Invitation {
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
  const router = useRouter();

  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        const response = await fetch('/api/invitations?status=PENDING');
        if (response.ok) {
          const data = await response.json();
          setInvitations(data);
        }
      } catch (error) {
        console.error('Error fetching invitations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvitations();
  }, []);

  const handleAccept = async (token: string) => {
    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'accept' }),
      });
      
      if (response.ok) {
        // Refresh invitations
        setInvitations(invitations.filter(inv => inv.token !== token));
        // Redirect to chat
        router.push('/chat');
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
    }
  };

  if (loading) {
    return <div>Loading invitations...</div>;
  }

  if (invitations.length === 0) {
    return <div>No pending invitations</div>;
  }

  return (
    <div>
      {invitations.map((invitation) => (
        <div key={invitation.id}>
          <h3>Invitation from {invitation.inviter?.name || 'Someone'}</h3>
          <p>To join {invitation.household?.name || 'household'}</p>
          <div>
            <Button onClick={() => handleAccept(invitation.token)}>
              Accept & Chat
            </Button>
            <Button onClick={() => router.push(`/invite?token=${invitation.token}`)}>
              View Details
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}