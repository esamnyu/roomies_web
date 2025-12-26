// src/app/api/households/[id]/balances/route.ts
import { NextResponse } from 'next/server';
import { withAuthParams, checkHouseholdAccess, errorResponse } from '@/lib/supabase-server';

export const GET = withAuthParams<Promise<{ id: string }>>(async (_request, user, supabase, params) => {
  const { id: householdId } = await params;

  // Check if user is member of the household
  const access = await checkHouseholdAccess(supabase, householdId, user.id);
  if (!access.authorized) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Get all household members
  const { data: householdMembers, error: membersError } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId);

  if (membersError || !householdMembers) {
    console.error('Error fetching household members:', membersError);
    return errorResponse('Failed to fetch household members');
  }

  // Get user details
  const userIds = householdMembers.map((member: { user_id: string }) => member.user_id);
  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', userIds);

  if (usersError || !users) {
    console.error('Error fetching user details:', usersError);
    return errorResponse('Failed to fetch user details');
  }

  // Create a map of user IDs to names
  const userMap = new Map<string, string>();
  users.forEach((u: { id: string; name: string }) => {
    userMap.set(u.id, u.name || 'Unknown');
  });

  // Get all expenses for the household with splits
  const { data: expenses, error: expensesError } = await supabase
    .from('expenses')
    .select(`
      id,
      amount,
      paid_by,
      splits:expense_splits(
        user_id,
        amount
      )
    `)
    .eq('household_id', householdId);

  if (expensesError) {
    console.error('Error fetching expenses:', expensesError);
    return errorResponse('Failed to fetch expenses');
  }

  // Calculate balance for each member
  const balances = userIds.map((userId: string) => {
    let net = 0;

    // Calculate what this user has paid
    (expenses || []).forEach((expense: { paid_by: string; amount: number; splits?: { user_id: string; amount: number }[] }) => {
      if (expense.paid_by === userId) {
        net += Number(expense.amount) || 0;
      }
    });

    // Calculate what this user owes (from splits)
    (expenses || []).forEach((expense: { splits?: { user_id: string; amount: number }[] }) => {
      const userSplits = expense.splits?.filter((split) => split.user_id === userId) || [];
      userSplits.forEach((split) => {
        net -= Number(split.amount) || 0;
      });
    });

    return {
      userId,
      userName: userMap.get(userId) || 'Unknown',
      net: parseFloat(net.toFixed(2)),
      isOwed: net > 0 ? parseFloat(net.toFixed(2)) : 0,
      owes: net < 0 ? parseFloat(Math.abs(net).toFixed(2)) : 0,
    };
  });

  return NextResponse.json(balances);
});
