import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Simple query to check connection
    const { data, error } = await supabase
      .from('User')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ 
        status: 'error', 
        message: 'Supabase query failed', 
        error: error.message,
        note: 'Connection succeeded but query failed - check if the User table exists'
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      status: 'success', 
      message: 'Supabase connection and query successful!',
      data: data || []
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ 
      status: 'error', 
      message: 'Unexpected error',
      error: message
    }, { status: 500 });
  }
}