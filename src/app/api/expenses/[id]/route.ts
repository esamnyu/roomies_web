// src/app/api/expenses/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Helper function to create Supabase client in Route Handlers
async function createSupabaseRouteHandlerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Handle potential errors during cookie setting
          }
        },
      },
    }
  );
}

// GET /api/expenses/[id] - Get a specific expense
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseRouteHandlerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: expenseId } = await params;

    // Get the expense
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select(`
        *,
        paid_by_user:profiles!paid_by(id, name, email, avatar_url),
        created_by_user:profiles!created_by(id, name, email, avatar_url),
        household:households!household_id(id, name),
        splits:expense_splits(
          *,
          user:profiles!user_id(id, name, email, avatar_url)
        )
      `)
      .eq('id', expenseId)
      .single();

    if (expenseError || !expense) {
      console.error('Error fetching expense:', expenseError);
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check if the user is a member of the household that the expense belongs to
    const { data: householdUser, error: membershipError } = await supabase
      .from('household_members')
      .select('user_id, household_id, role')
      .eq('user_id', user.id)
      .eq('household_id', expense.household_id)
      .single();

    if (membershipError || !householdUser) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }

    return NextResponse.json(expense);
  } catch (error) {
    console.error('Error fetching expense:', error);
    return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 });
  }
}

// PATCH /api/expenses/[id] - Update a specific expense
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseRouteHandlerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: expenseId } = await params;
    const data = await request.json();

    // Get the current expense to verify permissions
    const { data: currentExpense, error: expenseError } = await supabase
      .from('expenses')
      .select('id, created_by, paid_by, household_id')
      .eq('id', expenseId)
      .single();

    if (expenseError || !currentExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Only the creator can update the expense
    if (currentExpense.created_by !== user.id && currentExpense.paid_by !== user.id) {
      return NextResponse.json({ error: 'You are not authorized to update this expense' }, { status: 403 });
    }

    // Check if the user is a member of the household
    const { data: householdUser, error: membershipError } = await supabase
      .from('household_members')
      .select('user_id, household_id, role')
      .eq('user_id', user.id)
      .eq('household_id', currentExpense.household_id)
      .single();

    if (membershipError || !householdUser) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }

    // Extract the basic expense fields
    const {
      title,
      amount,
      date,
      description,
      splits
    } = data;

    // Update the expense
    const { error: updateError } = await supabase
      .from('expenses')
      .update({
        description: title || description, // Use title as description
        amount,
        date: date ? new Date(date).toISOString() : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', expenseId);

    if (updateError) {
      console.error('Error updating expense:', updateError);
      return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
    }

    // If splits are provided, update them
    if (splits && splits.length > 0) {
      // Delete existing splits
      const { error: deleteError } = await supabase
        .from('expense_splits')
        .delete()
        .eq('expense_id', expenseId);

      if (deleteError) {
        console.error('Error deleting existing splits:', deleteError);
        return NextResponse.json({ error: 'Failed to update expense splits' }, { status: 500 });
      }

      // Create new splits
      const now = new Date().toISOString();
      const splitsData = splits.map((split: any) => ({
        expense_id: expenseId,
        user_id: split.userId || split.user_id,
        amount: split.amount,
        settled: false,
        created_at: now,
        updated_at: now
      }));

      const { error: insertError } = await supabase
        .from('expense_splits')
        .insert(splitsData);

      if (insertError) {
        console.error('Error creating new splits:', insertError);
        return NextResponse.json({ error: 'Failed to update expense splits' }, { status: 500 });
      }
    }

    // Get the updated expense with all relations
    const { data: updatedExpense, error: fetchError } = await supabase
      .from('expenses')
      .select(`
        *,
        paid_by_user:profiles!paid_by(id, name, email, avatar_url),
        created_by_user:profiles!created_by(id, name, email, avatar_url),
        splits:expense_splits(
          *,
          user:profiles!user_id(id, name, email, avatar_url)
        )
      `)
      .eq('id', expenseId)
      .single();

    if (fetchError) {
      console.error('Error fetching updated expense:', fetchError);
      return NextResponse.json({ error: 'Expense updated but failed to fetch updated data' }, { status: 500 });
    }

    return NextResponse.json(updatedExpense);
  } catch (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

// DELETE /api/expenses/[id] - Delete a specific expense
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseRouteHandlerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: expenseId } = await params;

    // Get the current expense to verify permissions
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select('id, created_by, paid_by, household_id')
      .eq('id', expenseId)
      .single();

    if (expenseError || !expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check if the user is the creator or an admin of the household
    const { data: householdUser, error: membershipError } = await supabase
      .from('household_members')
      .select('user_id, household_id, role')
      .eq('user_id', user.id)
      .eq('household_id', expense.household_id)
      .single();

    const isCreator = expense.created_by === user.id || expense.paid_by === user.id;
    const isAdmin = householdUser?.role === 'admin';

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'You are not authorized to delete this expense' }, { status: 403 });
    }

    // Delete related splits first (cascade may handle this, but explicit is safer)
    const { error: splitsError } = await supabase
      .from('expense_splits')
      .delete()
      .eq('expense_id', expenseId);

    if (splitsError) {
      console.error('Error deleting related splits:', splitsError);
      // Continue anyway to try to delete the expense
    }

    // Delete the expense itself
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (deleteError) {
      console.error('Error deleting expense:', deleteError);
      return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
