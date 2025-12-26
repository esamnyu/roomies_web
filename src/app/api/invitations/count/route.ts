// src/app/api/invitations/count/route.ts
import { NextResponse } from 'next/server';
import { withAuth, errorResponse } from '@/lib/supabase-server';

export const GET = withAuth(async (_request, user, supabase) => {
  const { count, error } = await supabase
    .from('invitations')
    .select('*', { count: 'exact', head: true })
    .eq('email', user.email)
    .eq('status', 'pending');

  if (error) {
    console.error('Error fetching invitation count:', error);
    return errorResponse('Failed to fetch invitation count');
  }

  return NextResponse.json({ count: count || 0 });
});
