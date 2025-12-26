// src/app/api/households/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

// Define types to match the actual structure returned by Supabase
interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
}

interface Household {
  id: string;
  name: string;
  address?: string | null;
  created_at: string;
  updated_at: string;
}

interface HouseholdUser {
  id: string;
  userId: string;
  householdId: string;
  role: 'ADMIN' | 'MEMBER' | 'GUEST';
  joined_at: string;
  household: Household;
  user?: User;
}

interface HouseholdMember {
  id: string;
  role: 'ADMIN' | 'MEMBER' | 'GUEST';
  user: User;
}

interface CountResult {
  count: number | null;
  error: any;
}

// GET /api/households - Get all households for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get all households the user is a member of
    const { data: householdUsers, error: userError } = await supabase
      .from('household_members')
      .select(`
        id,
        userId,
        householdId,
        role,
        joinedAt,
        household:householdId(
          id,
          name,
          address,
          createdAt,
          updatedAt
        )
      `)
      .eq('user_id', session.user.id)
      .order('joined_at', { ascending: false });
    
    if (userError || !householdUsers) {
      console.error('Error fetching household memberships:', userError);
      return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 });
    }
    
    // Get additional data for each household
    const households = await Promise.all(householdUsers.map(async (hu: any) => {
      // Extract the household data from the nested result
      const household = hu.household as Household;
      const householdId = hu.householdId as string;
      
      // Get member count
      const memberCountResult = await supabase
        .from('household_members')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId);
      
      // Get counts for related entities
      const expenseCountResult = await supabase
        .from('Expense')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId);
      
      const taskCountResult = await supabase
        .from('Task')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId);
      
      const messageCountResult = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId);
      
      const ruleCountResult = await supabase
        .from('HouseRule')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId);
      
      // Get first 5 members with details
      const { data: membersData, error: memberFetchError } = await supabase
        .from('household_members')
        .select(`
          id,
          role,
          user:userId(
            id,
            name,
            avatar
          )
        `)
        .eq('household_id', householdId)
        .limit(5);
      
      if (memberFetchError) {
        console.error('Error fetching household members:', memberFetchError);
      }
      
      // Format member data carefully handling the structure
      const formattedMembers = (membersData || []).map((m: any) => {
        const user = m.user as User;
        return {
          id: user?.id,
          name: user?.name,
          avatar: user?.avatar,
          role: m.role
        };
      });
      
      // Return formatted household data
      return {
        id: household?.id,
        name: household?.name,
        address: household?.address,
        created_at: household?.created_at,
        updated_at: household?.updated_at,
        role: hu.role,
        joined_at: hu.joined_at,
        memberCount: memberCountResult.count || 0,
        expenseCount: expenseCountResult.count || 0,
        taskCount: taskCountResult.count || 0,
        messageCount: messageCountResult.count || 0,
        ruleCount: ruleCountResult.count || 0,
        members: formattedMembers
      };
    }));
    
    return NextResponse.json(households);
  } catch (error) {
    console.error('Error fetching households:', error);
    return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 });
  }
}

// POST /api/households - Create a new household
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { name, address } = await request.json();
    
    // Validate input
    if (!name) {
      return NextResponse.json({ error: 'Household name is required' }, { status: 400 });
    }
    
    // Create the household
    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert([
        {
          name,
          address,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select('*')
      .single();
    
    if (householdError || !household) {
      console.error('Error creating household:', householdError);
      return NextResponse.json({ error: 'Failed to create household' }, { status: 500 });
    }
    
    // Add the current user as an admin of the household
    const { error: memberError } = await supabase
      .from('household_members')
      .insert([
        {
          userId: session.user.id,
          householdId: household.id,
          role: 'ADMIN',
          joined_at: new Date().toISOString()
        }
      ]);
    
    if (memberError) {
      console.error('Error adding user to household:', memberError);
      
      // Try to delete the household since adding the user failed
      await supabase.from('households').delete().eq('id', household.id);
      
      return NextResponse.json({ error: 'Failed to create household membership' }, { status: 500 });
    }
    
    // Get the full household data with the member
    const { data: fullHouseholdData, error: fetchError } = await supabase
      .from('households')
      .select(`
        id,
        name,
        address,
        createdAt,
        updatedAt,
        members:HouseholdUser(
          id,
          role,
          joinedAt,
          user:userId(
            id,
            name,
            email,
            avatar
          )
        )
      `)
      .eq('id', household.id)
      .single();
    
    if (fetchError || !fullHouseholdData) {
      console.error('Error fetching full household data:', fetchError);
      return NextResponse.json({ 
        message: 'Household created but failed to fetch complete data',
        household: household
      }, { status: 201 });
    }
    
    return NextResponse.json(fullHouseholdData, { status: 201 });
  } catch (error) {
    console.error('Error creating household:', error);
    return NextResponse.json({ error: 'Failed to create household' }, { status: 500 });
  }
}