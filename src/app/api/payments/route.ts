// src/app/api/payments/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Removed Prisma import
// import { prisma } from '@/lib/prisma';
// Removed NextAuth imports
// import { getServerSession } from 'next-auth';
// import { authOptions } from '@/app/api/auth/[...nextauth]/route';
// Import the standardized Supabase client helper
import { createServerSupabaseClient } from '@/lib/supabase-ssr'; // Adjust path if needed
import { generateUUID } from '@/lib/utils'; // Assuming you have this

// Removed local helper function - use imported createServerSupabaseClient instead
/*
async function createSupabaseRouteHandlerClient() {
  // ... implementation ...
}
*/

// GET /api/payments - Get all payments for a user, with filters
export async function GET(request: NextRequest) {
  // Use the imported standardized helper
  const supabase = await createServerSupabaseClient();
  try {
    // Get session using Supabase client
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
        console.error('Error getting session:', sessionError);
        // Use descriptive error message
        return NextResponse.json({ error: 'Failed to retrieve session', details: sessionError.message }, { status: 500 });
    }
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const householdId = searchParams.get('householdId');
    const expenseId = searchParams.get('expenseId');

    // Start building the query for payments related to the current user
    // Use the 'supabase' instance from the helper
    let query = supabase
      .from('Payment')
      .select(`
        *,
        expense:Expense!inner(
          *,
          creator:User!creatorId(id, name, email, avatar),
          household:Household!inner(id, name)
        ),
        user:User!userId(id, name, email, avatar)
      `)
      .eq('userId', userId); // Base filter: payments for the logged-in user

    // Apply optional filters
    if (status) {
      query = query.eq('status', status);
    }
    if (expenseId) {
      query = query.eq('expenseId', expenseId);
    }
    if (householdId) {
      // Filter based on the householdId of the related expense
      query = query.eq('expense.householdId', householdId);
    }

    // Add ordering
    query = query
        .order('status', { ascending: true }) // PENDING first
        .order('createdAt', { ascending: false });


    // Execute the query
    const { data: payments, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching payments:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
    }

    return NextResponse.json(payments || []);

  } catch (error) {
    console.error('Error in GET /api/payments:', error);
    // Ensure error handling catches potential issues from createServerSupabaseClient if it throws
    const message = error instanceof Error ? error.message : 'Failed to fetch payments';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/payments - Create a new payment (e.g., manual settlement, though often handled during expense creation)
export async function POST(request: NextRequest) {
  // Use the imported standardized helper
  const supabase = await createServerSupabaseClient();
  try {
    // Get session using Supabase client
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
        console.error('Error getting session:', sessionError);
        return NextResponse.json({ error: 'Failed to retrieve session', details: sessionError.message }, { status: 500 });
    }
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserId = session.user.id;

    const { expenseId, userId, amount, status = 'PENDING' } = await request.json();

    // Validate required fields
    if (!expenseId || !userId || amount === undefined || amount === null) {
      return NextResponse.json({ error: 'Missing required fields: expenseId, userId, amount' }, { status: 400 });
    }
    const parsedAmount = parseFloat(amount);
     if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
     }
     const validStatuses = ['PENDING', 'COMPLETED', 'DECLINED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }


    // Check if the expense exists and get household info + creator
    // Use the 'supabase' instance from the helper
    const { data: expense, error: expenseError } = await supabase
      .from('Expense')
      .select('id, creatorId, householdId')
      .eq('id', expenseId)
      .single();

    if (expenseError || !expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check if the current user is a member of the household
    // Use the 'supabase' instance from the helper
     const { data: membership, error: membershipError } = await supabase
        .from('HouseholdUser')
        .select('userId, role')
        .eq('userId', currentUserId)
        .eq('householdId', expense.householdId)
        .single();

      if (membershipError || !membership) {
          return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
      }

    // Permissions: Only expense creator or admin can create payments for others. Users can create PENDING for themselves? (Decide policy)
    const isCreator = expense.creatorId === currentUserId;
    const isAdmin = membership.role === 'ADMIN';

    // Stricter: Prevent users from creating payments for others unless creator/admin
    if (userId !== currentUserId && !isCreator && !isAdmin) {
       return NextResponse.json({ error: 'You can only create payments for yourself unless you are the expense creator or an admin' }, { status: 403 });
     }
     // Decide if a user can directly create a COMPLETED payment for themselves - potentially risky without verification
     if (userId === currentUserId && status === 'COMPLETED' && !isCreator && !isAdmin) {
        return NextResponse.json({ error: 'Only the expense creator or admin can mark a payment as completed directly.' }, { status: 403 });
     }


    // Check if a payment already exists for this user and expense (optional but good practice)
    // Use the 'supabase' instance from the helper
    const { data: existingPayment, error: checkError } = await supabase
      .from('Payment')
      .select('id')
      .eq('expenseId', expenseId)
      .eq('userId', userId)
      .maybeSingle(); // Use maybeSingle to handle not found

      if (checkError){
         console.error("Error checking for existing payment:", checkError);
         // Proceed with caution or return error
      }
      if (existingPayment) {
        return NextResponse.json({ error: 'A payment for this user and expense already exists' }, { status: 409 }); // 409 Conflict
      }


    // Create the payment
    const paymentId = generateUUID();
    const now = new Date().toISOString();
    const paymentDate = status === 'COMPLETED' ? now : null;

    // Use the 'supabase' instance from the helper
    const { data: newPayment, error: insertError } = await supabase
      .from('Payment')
      .insert({
          id: paymentId,
          expenseId,
          userId,
          amount: parsedAmount,
          status,
          date: paymentDate,
          createdAt: now,
          updatedAt: now
      })
       .select(`
          *,
          expense:Expense!inner(
              *,
              creator:User!creatorId(id, name, email, avatar)
          ),
          user:User!userId(id, name, email, avatar)
       `)
      .single();

    if (insertError || !newPayment) {
      console.error('Error creating payment:', insertError);
      return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 });
    }

    return NextResponse.json(newPayment, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/payments:', error);
     // Ensure error handling catches potential issues from createServerSupabaseClient if it throws
    const message = error instanceof Error ? error.message : 'Failed to create payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}