'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function InvitationBadge() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchInvitationCount = async () => {
      try {
        const response = await fetch('/api/invitations/count');
        
        if (response.ok) {
          const data = await response.json();
          setCount(data.count || 0);
        }
      } catch (error) {
        console.error('Error fetching invitation count:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInvitationCount();
    
    // Optionally set up polling or real-time updates
    const interval = setInterval(fetchInvitationCount, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);
  
  if (loading || count === 0) {
    return null;
  }
  
  return (
    <Link href="/dashboard/invitations">
      <div className="relative inline-flex">
        <span className="sr-only">{count} pending invitations</span>
        <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 flex items-center justify-center text-xs text-white">
          {count}
        </span>
      </div>
    </Link>
  );
}