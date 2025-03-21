import { NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase';

export async function GET() {
  try {
    // Get current user session
    const { data: { session } } = await supabaseClient.auth.getSession();
    const userEmail = session?.user?.email;
    
    // Try direct query first (no RLS)
    const { data: directData, error: directError } = await supabaseClient
      .from('Invitation')
      .select('*')
      .limit(5);
    
    // Try query by email
    const { data: emailData, error: emailError } = await supabaseClient
      .from('Invitation')
      .select('*')
      .eq('email', userEmail || '')
      .eq('status', 'PENDING');
    
    return NextResponse.json({
      userEmail,
      directQuery: {
        success: !directError,
        count: directData?.length || 0,
        error: directError ? directError.message : null,
        data: directData?.slice(0, 2) || [] // Show just first 2 for brevity
      },
      emailQuery: {
        success: !emailError,
        count: emailData?.length || 0,
        error: emailError ? emailError.message : null,
        data: emailData || []
      }
    });
  } catch (err) {
    return NextResponse.json({
      error: 'Server error',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}