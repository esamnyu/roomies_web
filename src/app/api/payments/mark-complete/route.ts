// src/app/api/payments/mark-complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { householdId, fromUserId, toUserId, amount } = await request.json();
    
    // Verify the user is part of the household
    const { data: membership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, householdId, role')
      .eq('userId', session.user.id)
      .eq('householdId', householdId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'User is not a member of this household' }, { status: 403 });
    }
    
    // Create a record of the settlement payment
    const { data: settlement, error: settlementError } = await supabase
      .from('SettlementPayment')
      .insert({
        householdId,
        fromUserId,
        toUserId,
        amount,
        status: 'COMPLETED',
        date: new Date().toISOString(),
        createdById: session.user.id,
      })
      .select()
      .single();
    
    if (settlementError) {
      return NextResponse.json({ error: 'Failed to create settlement record' }, { status: 500 });
    }
    
    return NextResponse.json({ message: 'Payment marked as complete', settlement });
  } catch (error) {
    console.error('Error marking payment as complete:', error);
    return NextResponse.json({ error: 'Failed to mark payment as complete' }, { status: 500 });
  }
}