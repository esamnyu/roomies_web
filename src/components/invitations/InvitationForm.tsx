// src/components/invitations/InvitationForm.tsx
'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';

interface InvitationFormProps {
  householdId: string;
  onInviteSent?: () => void;
  onCancel?: () => void;
}

export default function InvitationForm({ 
  householdId, 
  onInviteSent, 
  onCancel 
}: InvitationFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER' | 'GUEST'>('MEMBER');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invitationLink, setInvitationLink] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    setInvitationLink('');

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address');
        setIsSubmitting(false);
        return;
      }

      // Call API to send invitation
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          householdId,
          role,
          message: message.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      // Show success message
      setSuccess(`Invitation sent to ${email}`);
      
      // Store the invitation link to display to the user
      if (data.invitation?.invitationLink) {
        setInvitationLink(data.invitation.invitationLink);
      }
      
      // Reset form
      setEmail('');
      setRole('MEMBER');
      setMessage('');
      
      // Notify parent component
      if (onInviteSent) {
        onInviteSent();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-md">
          {success}
          
          {invitationLink && (
            <div className="mt-2">
              <p className="text-sm font-medium">Invitation Link:</p>
              <div className="mt-1 flex">
                <input
                  type="text"
                  readOnly
                  value={invitationLink}
                  className="flex-1 p-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-l-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(invitationLink);
                    alert('Link copied to clipboard!');
                  }}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-r-md hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
              <p className="mt-1 text-xs">
                Share this link with your roommate to join your household.
              </p>
            </div>
          )}
        </div>
      )}
      
      <div>
        <label 
          htmlFor="email" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your roommate's email"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>
      
      <div>
        <label 
          htmlFor="role" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Role
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER' | 'GUEST')}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="ADMIN">Admin (Full access)</option>
          <option value="MEMBER">Member (Standard access)</option>
          <option value="GUEST">Guest (Limited access)</option>
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {role === 'ADMIN' && 'Admins can manage household settings, members, and all features.'}
          {role === 'MEMBER' && 'Members can create expenses, tasks, and participate in all activities.'}
          {role === 'GUEST' && 'Guests can view and participate in activities but cannot modify household settings.'}
        </p>
      </div>
      
      <div>
        <label 
          htmlFor="message" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Personal Message (Optional)
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a personal message to your invitation..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>
      
      <div className="flex justify-end space-x-3 pt-3">
        {onCancel && (
          <Button 
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Send Invitation'}
        </Button>
      </div>
    </form>
  );
}