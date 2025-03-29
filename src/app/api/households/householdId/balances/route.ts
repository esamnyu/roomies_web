// src/app/api/households/householdId/balances/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Removed NextAuth imports
// import { getServerSession } from 'next-auth';
// import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// Import the Supabase client helper for Route Handlers
import { createServerSupabaseClient } from '@/lib/supabase-ssr'; // Ensure this path is correct

// Assuming you might still use the admin client from lib/supabase for some operations,
// otherwise remove this if only the SSR client is needed here.
// import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { householdId: string } }
) {
  // Use the Supabase client helper to create a client instance for this request
  const supabase = await createServerSupabaseClient(); // Use the helper

  try {
    // Get the session using the Supabase client from the helper
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    // Add error handling for session retrieval
    if (sessionError) {
        console.error('Error getting session:', sessionError);
        return NextResponse.json({ error: 'Failed to retrieve session', details: sessionError.message }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the user ID from the Supabase session
    const userId = session.user.id;
    const householdId = params.householdId;

    // Check if user is member of the household using the same Supabase client instance
    const { data: membership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, householdId, role') // Select necessary fields
      .eq('userId', userId) // Use Supabase user ID
      .eq('householdId', householdId)
      .maybeSingle(); // Use maybeSingle to handle not found gracefully

    // Improved error handling for membership check
    if (membershipError) {
      console.error("Error checking household membership:", membershipError);
      // Don't expose detailed error messages unless necessary
      return NextResponse.json({ error: 'Failed to verify household membership' }, { status: 500 });
    }

    if (!membership) {
      return NextResponse.json({ error: 'User is not a member of this household' }, { status: 403 });
    }

    // --- Balance Calculation Logic (using the same 'supabase' client instance) ---

    // First, get all household members
    const { data: householdMembers, error: membersError } = await supabase
      .from('HouseholdUser')
      .select('userId')
      .eq('householdId', householdId);

    if (membersError || !householdMembers) {
       console.error('Error fetching household members:', membersError);
      return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
    }

    // Then, get user details separately
    const userIds = householdMembers.map(member => member.userId);
    const { data: users, error: usersError } = await supabase
      .from('User') // Ensure 'User' is your public user table name
      .select('id, name')
      .in('id', userIds);

    if (usersError || !users) {
       console.error('Error fetching user details:', usersError);
      return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 });
    }

    // Create a map of user IDs to names for easy lookup
    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user.id, user.name);
    });

    // Get all expenses for the household
    const { data: expenses, error: expensesError } = await supabase
      .from('Expense')
      .select(`
        id,
        amount,
        creatorId,
        splits:ExpenseSplit(
          userId,
          amount
        )
      `)
      .eq('householdId', householdId);

    if (expensesError || !expenses) {
       console.error('Error fetching expenses:', expensesError);
      return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
    }

    // Calculate balance for each member
    const balances = userIds.map(currentMemberId => { // Renamed loop variable
      let net = 0;

      // Calculate what this user has paid (expenses they created)
      expenses.forEach(expense => {
        if (expense.creatorId === currentMemberId) {
          net += expense.amount;
        }
      });

      // Calculate what this user owes (from splits)
      expenses.forEach(expense => {
        // Ensure splits is an array before filtering
        const userSplits = Array.isArray(expense.splits)
                           ? expense.splits.filter(split => split.userId === currentMemberId)
                           : [];
        userSplits.forEach(split => {
          // Ensure split.amount is a number
          const splitAmount = typeof split.amount === 'number' ? split.amount : 0;
          net -= splitAmount;
        });
      });

      // Format the balance data
      return {
        userId: currentMemberId,
        userName: userMap.get(currentMemberId) || 'Unknown',
        net: parseFloat(net.toFixed(2)),
        isOwed: net > 0 ? parseFloat(net.toFixed(2)) : 0,
        owes: net < 0 ? parseFloat(Math.abs(net).toFixed(2)) : 0,
      };
    });

    return NextResponse.json(balances);
  } catch (error) {
    console.error('Error fetching household balances:', error);
    // Ensure error handling catches potential issues from createServerSupabaseClient if it throws
    const message = error instanceof Error ? error.message : 'Failed to fetch balances';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}