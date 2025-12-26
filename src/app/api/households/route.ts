// src/app/api/households/route.ts
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

// GET /api/households - Get all households for the current user
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseRouteHandlerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError?.message || 'No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all households the user is a member of
    const { data: householdUsers, error: membershipError } = await supabase
      .from('household_members')
      .select(`
        id,
        user_id,
        household_id,
        role,
        joined_at,
        household:households!household_id(
          id,
          name,
          address,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });

    if (membershipError || !householdUsers) {
      console.error('Error fetching household memberships:', membershipError);
      return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 });
    }

    // Get additional data for each household
    const households = await Promise.all(householdUsers.map(async (hu: any) => {
      // Extract the household data from the nested result
      const household = hu.household;
      const householdId = hu.household_id as string;

      // Get member count
      const memberCountResult = await supabase
        .from('household_members')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId);

      // Get counts for related entities
      const expenseCountResult = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId);

      // Note: Using expense_splits count as a proxy for tasks if no tasks table exists
      // If you have a household_chores table, use that instead
      const taskCountResult = await supabase
        .from('household_chores')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId);

      const messageCountResult = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId);

      // Get first 5 members with details
      const { data: membersData, error: memberFetchError } = await supabase
        .from('household_members')
        .select(`
          id,
          role,
          user:profiles!user_id(
            id,
            name,
            avatar_url
          )
        `)
        .eq('household_id', householdId)
        .limit(5);

      if (memberFetchError) {
        console.error('Error fetching household members:', memberFetchError);
      }

      // Format member data carefully handling the structure
      const formattedMembers = (membersData || []).map((m: any) => {
        const memberUser = m.user;
        return {
          id: memberUser?.id,
          name: memberUser?.name,
          avatar: memberUser?.avatar_url,
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
        ruleCount: 0, // Removed HouseRule query if table doesn't exist
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
  const supabase = await createSupabaseRouteHandlerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError?.message || 'No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, address } = await request.json();

    // Validate input
    if (!name) {
      return NextResponse.json({ error: 'Household name is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Create the household
    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert([
        {
          name,
          address,
          created_at: now,
          updated_at: now
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
          user_id: user.id,
          household_id: household.id,
          role: 'admin',
          joined_at: now
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
        created_at,
        updated_at,
        members:household_members(
          id,
          role,
          joined_at,
          user:profiles!user_id(
            id,
            name,
            email,
            avatar_url
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
