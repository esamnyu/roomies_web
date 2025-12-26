// src/app/api/payments/mark-complete/route.ts
// Records a direct settlement payment between users
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createSupabaseRouteHandlerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch (error) { console.error("Error setting cookie:", name, error); }
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) { console.error("Error removing cookie:", name, error); }
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseRouteHandlerClient();

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { householdId, fromUserId, toUserId, amount, description } = await request.json();

    if (!householdId || !fromUserId || !toUserId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the user is part of the household
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('user_id, household_id, role')
      .eq('user_id', session.user.id)
      .eq('household_id', householdId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'User is not a member of this household' }, { status: 403 });
    }

    // Create a settlement record (this is the correct table)
    const { data: settlement, error: settlementError } = await supabase
      .from('settlements')
      .insert({
        household_id: householdId,
        payer_id: fromUserId,
        payee_id: toUserId,
        amount: parseFloat(amount),
        description: description || 'Direct settlement payment',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (settlementError) {
      console.error('Error creating settlement:', settlementError);
      return NextResponse.json({ error: 'Failed to create settlement record' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Payment marked as complete',
      settlement
    });
  } catch (error) {
    console.error('Error marking payment as complete:', error);
    return NextResponse.json({ error: 'Failed to mark payment as complete' }, { status: 500 });
  }
}
