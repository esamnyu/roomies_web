import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Create a Supabase client with the user's session
    const supabase = createServerComponentClient({ cookies });
    
    // Get the current user's session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the count of pending invitations for the user
    const { count, error } = await supabase
      .from('Invitation')
      .select('*', { count: 'exact', head: true })
      .eq('email', session.user.email)
      .eq('status', 'PENDING');
    
    if (error) {
      console.error('Error fetching invitation count:', error);
      return NextResponse.json({ error: 'Failed to fetch invitation count' }, { status: 500 });
    }
    
    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('Error in invitation count API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}