// src/app/api/expenses/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Removed direct supabase import, assuming helper provides client
// import { supabase } from '@/lib/supabase';
// Import the Supabase client helper for Route Handlers
import { createServerSupabaseClient } from '@/lib/supabase-ssr'; // Or '@/lib/supabase-ssr' if typo exists

// GET /api/expenses/[id] - Get a specific expense
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Use the Supabase client helper - *** CORRECTED FUNCTION CALL ***
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

    const expenseId = params.id;

    // Get the expense
    // Use the 'supabase' instance from the helper
    const { data: expense, error: expenseError } = await supabase
      .from('Expense')
      .select(`
        *,
        creator:creatorId(id, name, email, avatar),
        household:householdId(id, name),
        splits:ExpenseSplit(
          *,
          user:userId(id, name, email, avatar)
        ),
        payments:Payment(
          *,
          user:userId(id, name, email, avatar)
        )
      `)
      .eq('id', expenseId)
      .single();

    if (expenseError || !expense) {
      console.error('Error fetching expense:', expenseError);
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check if the user is a member of the household that the expense belongs to
    // Use the 'supabase' instance from the helper
    const { data: householdUser, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, householdId, role')
      .eq('userId', session.user.id) // Use ID from Supabase session
      .eq('householdId', expense.householdId)
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
  { params }: { params: { id: string } }
) {
  // Use the Supabase client helper - *** CORRECTED FUNCTION CALL ***
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

    const expenseId = params.id;
    const data = await request.json();

    // Get the current expense to verify permissions
    // Use the 'supabase' instance from the helper
    const { data: currentExpense, error: expenseError } = await supabase
      .from('Expense')
      .select('id, creatorId, householdId')
      .eq('id', expenseId)
      .single();

    if (expenseError || !currentExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Only the creator can update the expense
    if (currentExpense.creatorId !== session.user.id) { // Use ID from Supabase session
      return NextResponse.json({ error: 'You are not authorized to update this expense' }, { status: 403 });
    }

    // Check if the user is a member of the household
    // Use the 'supabase' instance from the helper
    const { data: householdUser, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, householdId, role')
      .eq('userId', session.user.id) // Use ID from Supabase session
      .eq('householdId', currentExpense.householdId)
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
      splitType,
      splits,
      payments
    } = data;

    // Update the expense - Note: Supabase doesn't have built-in transactions like Prisma
    // so we'll have to handle each part separately using the 'supabase' instance from the helper

    // 1. Update the base expense
    const { error: updateError } = await supabase
      .from('Expense')
      .update({
        title,
        amount,
        date: date ? new Date(date).toISOString() : undefined,
        description,
        splitType,
        updatedAt: new Date().toISOString()
      })
      .eq('id', expenseId);

    if (updateError) {
      console.error('Error updating expense:', updateError);
      return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
    }

    // 2. If splits are provided, update them
    if (splits && splits.length > 0) {
      // Delete existing splits
      const { error: deleteError } = await supabase
        .from('ExpenseSplit')
        .delete()
        .eq('expenseId', expenseId);

      if (deleteError) {
        console.error('Error deleting existing splits:', deleteError);
        return NextResponse.json({ error: 'Failed to update expense splits' }, { status: 500 });
      }

      // Create new splits
      const splitsData = splits.map((split: any) => ({
        expenseId,
        userId: split.userId,
        amount: split.amount,
        percentage: split.percentage || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('ExpenseSplit')
        .insert(splitsData);

      if (insertError) {
        console.error('Error creating new splits:', insertError);
        return NextResponse.json({ error: 'Failed to update expense splits' }, { status: 500 });
      }
    }

    // 3. If payments are provided, update them
    if (payments && payments.length > 0) {
      // Handle each payment individually
      for (const payment of payments) {
        if (payment.id && payment.id !== 'new-payment') {
          // Update existing payment
          const { error: paymentUpdateError } = await supabase
            .from('Payment')
            .update({
              amount: payment.amount,
              status: payment.status,
              date: payment.status === 'COMPLETED' ? new Date().toISOString() : null,
              updatedAt: new Date().toISOString()
            })
            .eq('id', payment.id);

          if (paymentUpdateError) {
            console.error('Error updating payment:', paymentUpdateError);
            // Continue with other payments rather than failing the whole request
          }
        } else {
          // Create new payment
          const { error: paymentCreateError } = await supabase
            .from('Payment')
            .insert({
              expenseId,
              userId: payment.userId,
              amount: payment.amount,
              status: payment.status,
              date: payment.status === 'COMPLETED' ? new Date().toISOString() : null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });

          if (paymentCreateError) {
            console.error('Error creating payment:', paymentCreateError);
            // Continue with other payments rather than failing the whole request
          }
        }
      }
    }

    // 4. Get the updated expense with all relations
    const { data: updatedExpense, error: fetchError } = await supabase
      .from('Expense')
      .select(`
        *,
        creator:creatorId(id, name, email, avatar),
        splits:ExpenseSplit(
          *,
          user:userId(id, name, email, avatar)
        ),
        payments:Payment(
          *,
          user:userId(id, name, email, avatar)
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
  { params }: { params: { id: string } }
) {
  // Use the Supabase client helper - *** CORRECTED FUNCTION CALL ***
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

    const expenseId = params.id;

    // Get the current expense to verify permissions
    // Use the 'supabase' instance from the helper
    const { data: expense, error: expenseError } = await supabase
      .from('Expense')
      .select('id, creatorId, householdId')
      .eq('id', expenseId)
      .single();

    if (expenseError || !expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check if the user is the creator or an admin of the household
    // Use the 'supabase' instance from the helper
    const { data: householdUser, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, householdId, role')
      .eq('userId', session.user.id) // Use ID from Supabase session
      .eq('householdId', expense.householdId)
      .single();

    const isCreator = expense.creatorId === session.user.id; // Use ID from Supabase session
    const isAdmin = householdUser?.role === 'ADMIN';

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'You are not authorized to delete this expense' }, { status: 403 });
    }

    // In Supabase, we have to delete related records manually
    // unless we've set up ON DELETE CASCADE foreign key constraints
    // Use the 'supabase' instance from the helper for all deletions

    // 1. Delete related payments
    const { error: paymentsError } = await supabase
      .from('Payment')
      .delete()
      .eq('expenseId', expenseId);

    if (paymentsError) {
      console.error('Error deleting related payments:', paymentsError);
      // Continue anyway to try to delete the expense
    }

    // 2. Delete related splits
    const { error: splitsError } = await supabase
      .from('ExpenseSplit')
      .delete()
      .eq('expenseId', expenseId);

    if (splitsError) {
      console.error('Error deleting related splits:', splitsError);
      // Continue anyway to try to delete the expense
    }

    // 3. Delete the expense itself
    const { error: deleteError } = await supabase
      .from('Expense')
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