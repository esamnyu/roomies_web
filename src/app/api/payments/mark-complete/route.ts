// src/app/api/payments/mark-complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Removed NextAuth imports
// import { getServerSession } from 'next-auth';
// import { authOptions } from '@/app/api/auth/[...nextauth]/route';
// Import the standardized Supabase client helper
import { createServerSupabaseClient } from '@/lib/supabase-ssr'; // Adjust path if needed
// Assuming the direct import is not needed if the helper provides the client
// import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  // Use the Supabase client helper
  const supabase = await createServerSupabaseClient();
  try {
    // Get session using Supabase client
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    // Add error handling for session retrieval
    if (sessionError) {
        console.error('Error getting session:', sessionError);
        return NextResponse.json({ error: 'Failed to retrieve session', details: sessionError.message }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { householdId, fromUserId, toUserId, amount } = await request.json();

    // Verify the user is part of the household
    // Use the 'supabase' instance from the helper
    const { data: membership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, householdId, role')
      .eq('userId', session.user.id) // Use ID from Supabase session
      .eq('householdId', householdId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'User is not a member of this household' }, { status: 403 });
    }

    // Create a record of the settlement payment
    // Use the 'supabase' instance from the helper
    // Ensure your 'SettlementPayment' table exists and has these columns
    const { data: settlement, error: settlementError } = await supabase
      .from('SettlementPayment') // Ensure this table name is correct
      .insert({
        householdId,
        fromUserId,
        toUserId,
        amount,
        status: 'COMPLETED', // Assuming settlements are always completed
        date: new Date().toISOString(),
        createdById: session.user.id, // Use ID from Supabase session
      })
      .select()
      .single();

    if (settlementError) {
      console.error('Error creating settlement record:', settlementError);
      return NextResponse.json({ error: 'Failed to create settlement record' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Payment marked as complete', settlement });
  } catch (error) {
    console.error('Error marking payment as complete:', error);
    const message = error instanceof Error ? error.message : 'Failed to mark payment as complete';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}