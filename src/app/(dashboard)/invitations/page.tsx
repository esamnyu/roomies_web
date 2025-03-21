'use client';

import UserInvitationsList from '@/components/invitations/UserInvitationsList';

export default function InvitationsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Your Invitations</h1>
      <UserInvitationsList />
    </div>
  );
}