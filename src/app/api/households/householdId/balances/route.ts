// src/app/api/households/[householdId]/balances/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { householdId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const householdId = params.householdId;
    
    // Check if user is member of the household
    const { data: membership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, householdId, role')
      .eq('userId', session.user.id)
      .eq('householdId', householdId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'User is not a member of this household' }, { status: 403 });
    }
    
    // First, get all household members
    const { data: householdMembers, error: membersError } = await supabase
      .from('HouseholdUser')
      .select('userId')
      .eq('householdId', householdId);
    
    if (membersError || !householdMembers) {
      return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
    }
    
    // Then, get user details separately to avoid foreign key join issues
    const userIds = householdMembers.map(member => member.userId);
    const { data: users, error: usersError } = await supabase
      .from('User')
      .select('id, name')
      .in('id', userIds);
    
    if (usersError || !users) {
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
      return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
    }
    
    // Calculate balance for each member
    const balances = userIds.map(userId => {
      let net = 0;
      
      // Calculate what this user has paid (expenses they created)
      expenses.forEach(expense => {
        if (expense.creatorId === userId) {
          net += expense.amount;
        }
      });
      
      // Calculate what this user owes (from splits)
      expenses.forEach(expense => {
        const userSplits = expense.splits?.filter(split => split.userId === userId) || [];
        userSplits.forEach(split => {
          net -= split.amount;
        });
      });
      
      // Format the balance data
      return {
        userId: userId,
        userName: userMap.get(userId) || 'Unknown',
        net: parseFloat(net.toFixed(2)),
        isOwed: net > 0 ? parseFloat(net.toFixed(2)) : 0,
        owes: net < 0 ? parseFloat(Math.abs(net).toFixed(2)) : 0,
      };
    });
    
    return NextResponse.json(balances);
  } catch (error) {
    console.error('Error fetching household balances:', error);
    return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 });
  }
}