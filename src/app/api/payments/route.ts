// src/app/api/payments/route.ts
// NOTE: The original code used a "Payment" table that doesn't exist.
// This has been adapted to use expense_splits with the 'settled' field for payment tracking.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Helper function
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

// GET /api/payments - Get all payment obligations (expense splits) for a user
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseRouteHandlerClient();
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'pending', 'completed'
    const householdId = searchParams.get('household_id') || searchParams.get('householdId');
    const expenseId = searchParams.get('expenseId') || searchParams.get('expense_id');

    // Start building the query for expense splits for the current user
    let query = supabase
      .from('expense_splits')
      .select(`
        id,
        expense_id,
        user_id,
        amount,
        settled,
        settled_at,
        created_at,
        updated_at,
        expense:expenses!inner(
          id,
          description,
          amount,
          date,
          household_id,
          paid_by,
          created_by,
          paid_by_user:profiles!paid_by(id, name, email, avatar_url),
          household:households!household_id(id, name)
        ),
        user:profiles!user_id(id, name, email, avatar_url)
      `)
      .eq('user_id', userId);

    // Apply optional filters
    if (status) {
      const isSettled = status.toLowerCase() === 'completed' || status.toLowerCase() === 'settled';
      query = query.eq('settled', isSettled);
    }
    if (expenseId) {
      query = query.eq('expense_id', expenseId);
    }
    if (householdId) {
      query = query.eq('expense.household_id', householdId);
    }

    // Add ordering - unsettled first, then by date
    query = query
      .order('settled', { ascending: true })
      .order('created_at', { ascending: false });

    const { data: splits, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching payments (splits):', fetchError);
      return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
    }

    // Transform to match expected payment format
    const payments = (splits || []).map(split => ({
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
    }));

    return NextResponse.json(payments);

  } catch (error) {
    console.error('Error in GET /api/payments:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch payments';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/payments - Mark a split as settled (create a settlement)
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseRouteHandlerClient();
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserId = session.user.id;
    const body = await request.json();
    const { expenseId, userId, splitId, status = 'PENDING' } = body;

    // If splitId is provided, update that specific split
    if (splitId) {
      const { data: split, error: splitError } = await supabase
        .from('expense_splits')
        .select('*, expense:expenses!inner(household_id, paid_by)')
        .eq('id', splitId)
        .single();

      if (splitError || !split) {
        return NextResponse.json({ error: 'Split not found' }, { status: 404 });
      }

      // Check membership
      const { data: membership, error: membershipError } = await supabase
        .from('household_members')
        .select('user_id, role')
        .eq('user_id', currentUserId)
        .eq('household_id', split.expense.household_id)
        .single();

      if (membershipError || !membership) {
        return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
      }

      // Only the expense payer, the split owner, or admin can update
      const isExpensePayer = split.expense.paid_by === currentUserId;
      const isSplitOwner = split.user_id === currentUserId;
      const isAdmin = membership.role === 'admin';

      if (!isExpensePayer && !isSplitOwner && !isAdmin) {
        return NextResponse.json({ error: 'Not authorized to update this payment' }, { status: 403 });
      }

      const isSettled = status.toUpperCase() === 'COMPLETED';
      const now = new Date().toISOString();

      const { data: updatedSplit, error: updateError } = await supabase
        .from('expense_splits')
        .update({
          settled: isSettled,
          settled_at: isSettled ? now : null,
          updated_at: now
        })
        .eq('id', splitId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating split:', updateError);
        return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
      }

      return NextResponse.json({
        id: updatedSplit.id,
        expenseId: updatedSplit.expense_id,
        userId: updatedSplit.user_id,
        amount: updatedSplit.amount,
        status: updatedSplit.settled ? 'COMPLETED' : 'PENDING',
        date: updatedSplit.settled_at,
        created_at: updatedSplit.created_at,
        updated_at: updatedSplit.updated_at
      });
    }

    // Legacy: Find split by expenseId and userId
    if (!expenseId || !userId) {
      return NextResponse.json({ error: 'Missing required fields: expenseId and userId, or splitId' }, { status: 400 });
    }

    const { data: split, error: splitError } = await supabase
      .from('expense_splits')
      .select('*, expense:expenses!inner(household_id, paid_by)')
      .eq('expense_id', expenseId)
      .eq('user_id', userId)
      .single();

    if (splitError || !split) {
      return NextResponse.json({ error: 'Payment split not found' }, { status: 404 });
    }

    // Check membership
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('user_id, role')
      .eq('user_id', currentUserId)
      .eq('household_id', split.expense.household_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }

    const isExpensePayer = split.expense.paid_by === currentUserId;
    const isSplitOwner = split.user_id === currentUserId;
    const isAdmin = membership.role === 'admin';

    if (!isExpensePayer && !isSplitOwner && !isAdmin) {
      return NextResponse.json({ error: 'Not authorized to update this payment' }, { status: 403 });
    }

    const isSettled = status.toUpperCase() === 'COMPLETED';
    const now = new Date().toISOString();

    const { data: updatedSplit, error: updateError } = await supabase
      .from('expense_splits')
      .update({
        settled: isSettled,
        settled_at: isSettled ? now : null,
        updated_at: now
      })
      .eq('id', split.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating split:', updateError);
      return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }

    return NextResponse.json({
      id: updatedSplit.id,
      expenseId: updatedSplit.expense_id,
      userId: updatedSplit.user_id,
      amount: updatedSplit.amount,
      status: updatedSplit.settled ? 'COMPLETED' : 'PENDING',
      date: updatedSplit.settled_at,
      created_at: updatedSplit.created_at,
      updated_at: updatedSplit.updated_at
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/payments:', error);
    const message = error instanceof Error ? error.message : 'Failed to create/update payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
