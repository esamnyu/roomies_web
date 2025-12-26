// src/app/api/payments/[id]/route.ts
// NOTE: Adapted to use expense_splits instead of non-existent Payment table
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

// Helper to check permissions
async function checkSplitPermissions(supabase: any, splitId: string, userId: string) {
  const { data: split, error: splitError } = await supabase
    .from('expense_splits')
    .select(`
      *,
      expense:expenses!inner(
        id,
        paid_by,
        created_by,
        household_id
      )
    `)
    .eq('id', splitId)
    .single();

  if (splitError) {
    console.error("Error fetching split for permission check:", splitError);
    return { allowed: false, error: 'Failed to fetch payment data.', status: 500 };
  }
  if (!split) {
    return { allowed: false, error: 'Payment not found.', status: 404 };
  }

  const { data: membership, error: membershipError } = await supabase
    .from('household_members')
    .select('user_id, role')
    .eq('user_id', userId)
    .eq('household_id', split.expense.household_id)
    .single();

  if (membershipError) {
    console.error("Error checking household membership:", membershipError);
    return { allowed: false, error: 'Failed to verify household membership.', status: 500 };
  }
  if (!membership) {
    return { allowed: false, error: 'You are not a member of this household.', status: 403 };
  }

  return { allowed: true, split, membership };
}

// GET /api/payments/[id] - Get a specific payment (expense split)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseRouteHandlerClient();
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: splitId } = await params;
    if (!splitId) return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });

    const { data: split, error: fetchError } = await supabase
      .from('expense_splits')
      .select(`
        *,
        expense:expenses!inner(
          *,
          paid_by_user:profiles!paid_by(id, name, email, avatar_url),
          household:households!household_id(id, name)
        ),
        user:profiles!user_id(id, name, email, avatar_url)
      `)
      .eq('id', splitId)
      .single();

    if (fetchError || !split) {
      console.error('Error fetching payment:', fetchError);
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Verify membership
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('user_id', session.user.id)
      .eq('household_id', split.expense.household_id)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) {
      return NextResponse.json({ error: 'You are not authorized to view this payment' }, { status: 403 });
    }

    // Transform to expected format
    const payment = {
      id: split.id,
      expenseId: split.expense_id,
      userId: split.user_id,
      amount: split.amount,
      status: split.settled ? 'COMPLETED' : 'PENDING',
      date: split.settled_at,
      created_at: split.created_at,
      updated_at: split.updated_at,
      expense: split.expense,
      user: split.user
    };

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error in GET /api/payments/[id]:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/payments/[id] - Update payment status (mark split as settled/unsettled)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseRouteHandlerClient();
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: splitId } = await params;
    if (!splitId) return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });

    const { status } = await request.json();

    // Validate status
    if (!status || !['PENDING', 'COMPLETED', 'DECLINED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status value. Must be PENDING, COMPLETED, or DECLINED' }, { status: 400 });
    }

    const permCheck = await checkSplitPermissions(supabase, splitId, session.user.id);
    if (!permCheck.allowed) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }
    const { split, membership } = permCheck;

    // Determine who can update
    const isSplitUser = split.user_id === session.user.id;
    const isExpensePayer = split.expense.paid_by === session.user.id;
    const isAdmin = membership.role === 'admin';

    if (!isSplitUser && !isExpensePayer && !isAdmin) {
      return NextResponse.json({ error: 'You are not authorized to update this payment' }, { status: 403 });
    }

    const isSettled = status === 'COMPLETED';
    const now = new Date().toISOString();

    const { data: updatedSplit, error: updateError } = await supabase
      .from('expense_splits')
      .update({
        settled: isSettled,
        settled_at: isSettled ? now : null,
        updated_at: now
      })
      .eq('id', splitId)
      .select(`
        *,
        expense:expenses!inner(
          *,
          paid_by_user:profiles!paid_by(id, name, email, avatar_url)
        ),
        user:profiles!user_id(id, name, email, avatar_url)
      `)
      .single();

    if (updateError || !updatedSplit) {
      console.error('Error updating payment:', updateError);
      return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 });
    }

    const payment = {
      id: updatedSplit.id,
      expenseId: updatedSplit.expense_id,
      userId: updatedSplit.user_id,
      amount: updatedSplit.amount,
      status: updatedSplit.settled ? 'COMPLETED' : 'PENDING',
      date: updatedSplit.settled_at,
      created_at: updatedSplit.created_at,
      updated_at: updatedSplit.updated_at,
      expense: updatedSplit.expense,
      user: updatedSplit.user
    };

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error in PATCH /api/payments/[id]:', error);
    const message = error instanceof Error ? error.message : 'Failed to update payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/payments/[id] - This doesn't make sense for splits, but provide response
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { error: 'Expense splits cannot be deleted directly. Delete the expense instead.' },
    { status: 400 }
  );
}
