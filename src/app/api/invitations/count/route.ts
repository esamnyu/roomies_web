// src/app/api/invitations/count/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/auth';
import { handleApiError } from '@/lib/errorhandler';

// GET /api/invitations/count - Get pending invitations count for current user
export const GET = withAuth(async (request: NextRequest, user: any) => {
  try {
    const supabase = getSupabaseClient();
    
    // Get the count of pending invitations for the user
    const { count, error } = await supabase
      .from('Invitation')
      .select('*', { count: 'exact', head: true })
      .eq('email', user.email)
      .eq('status', 'PENDING');
    
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch invitation count' }, { status: 500 });
    }
    
    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    return handleApiError(error);
  }
});