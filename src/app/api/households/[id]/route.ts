// src/app/api/households/[id]/route.ts
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

// Helper: Check household membership and optionally admin role
async function checkHouseholdAccess(
  supabase: any,
  householdId: string,
  userId: string,
  requireAdmin = false
) {
  const { data: membership, error } = await supabase
    .from('household_members')
    .select('user_id, role')
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .maybeSingle();

  if (error) {
    console.error('Error checking household membership:', householdId, userId, error);
    return { authorized: false, error: 'Failed to verify household membership.', status: 500 };
  }

  if (!membership) {
    return { authorized: false, error: 'You are not a member of this household.', status: 403 };
  }

  if (requireAdmin && membership.role !== 'admin') {
    return { authorized: false, error: 'Only household admins can perform this action.', status: 403 };
  }

  return { authorized: true, membership };
}

// GET /api/households/[id] - Get a specific household's details
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

    const { id: householdId } = await params;
    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }

    // Check if user is a member of the household
    const accessCheck = await checkHouseholdAccess(supabase, householdId, user.id);
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    // Get the household with related data
    const { data: household, error: fetchError } = await supabase
      .from('households')
      .select(`
        *,
        members:household_members(
          *,
          user:profiles!user_id(id, name, email, avatar_url)
        ),
        expenses:expenses(*),
        chores:household_chores(*)
      `)
      .eq('id', householdId)
      .single();

    if (fetchError) {
      console.error('Error fetching household details:', fetchError);
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Household not found.' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch household details.' }, { status: 500 });
    }

    if (!household) {
      return NextResponse.json({ error: 'Household not found.' }, { status: 404 });
    }

    return NextResponse.json(household);
  } catch (error) {
    console.error('Error in GET /api/households/[id]:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch household';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/households/[id] - Update a specific household
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

    const { id: householdId } = await params;
    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }

    // Check if user is an ADMIN of the household
    const accessCheck = await checkHouseholdAccess(supabase, householdId, user.id, true);
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    // Get update data from request body
    const body = await request.json();
    const { name, address } = body;

    // Prepare update data
    const updateData: { name?: string; address?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json({ error: 'Household name cannot be empty' }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (address !== undefined) {
      updateData.address = (typeof address === 'string' && address.trim() !== '') ? address.trim() : null;
    }

    // Check if there's anything to update besides the timestamp
    if (Object.keys(updateData).length <= 1) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 });
    }

    // Update the household
    const { data: updatedHousehold, error: updateError } = await supabase
      .from('households')
      .update(updateData)
      .eq('id', householdId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating household:', updateError);
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Household not found.' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to update household.' }, { status: 500 });
    }

    if (!updatedHousehold) {
      return NextResponse.json({ error: 'Household not found after update attempt.' }, { status: 404 });
    }

    return NextResponse.json(updatedHousehold);
  } catch (error) {
    console.error('Error in PATCH /api/households/[id]:', error);
    const message = error instanceof Error ? error.message : 'Failed to update household';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/households/[id] - Delete a specific household
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

    const { id: householdId } = await params;
    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }

    // Check if user is an ADMIN of the household
    const accessCheck = await checkHouseholdAccess(supabase, householdId, user.id, true);
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    // Count members - prevent deletion if other members exist
    const { count: membersCount, error: countError } = await supabase
      .from('household_members')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId);

    if (countError) {
      console.error('Error counting household members:', countError);
      return NextResponse.json({ error: 'Failed to verify member count before deletion.' }, { status: 500 });
    }

    if (membersCount === null || membersCount > 1) {
      return NextResponse.json({
        error: `Cannot delete household with ${membersCount ?? '?'} members. Remove other members first.`
      }, { status: 400 });
    }

    console.warn(`Executing household ${householdId} deletion.`);

    // Delete related records

    // Get expense IDs first
    const { data: expensesToDelete, error: expenseIdsError } = await supabase
      .from('expenses')
      .select('id')
      .eq('household_id', householdId);

    if (expenseIdsError) {
      console.error('Error fetching expense IDs for deletion:', expenseIdsError);
      return NextResponse.json({ error: 'Failed to get related expense IDs.' }, { status: 500 });
    }

    // Delete expense-related data
    if (expensesToDelete && expensesToDelete.length > 0) {
      const expenseIds = expensesToDelete.map(e => e.id);

      const { error: deleteSplitsError } = await supabase
        .from('expense_splits')
        .delete()
        .in('expense_id', expenseIds);
      if (deleteSplitsError) console.error('Error deleting expense_splits:', deleteSplitsError);

      // Delete the expenses themselves
      const { error: deleteExpensesError } = await supabase
        .from('expenses')
        .delete()
        .in('id', expenseIds);
      if (deleteExpensesError) console.error('Error deleting expenses:', deleteExpensesError);
    }

    // Delete chores
    const { error: deleteChoresError } = await supabase
      .from('household_chores')
      .delete()
      .eq('household_id', householdId);
    if (deleteChoresError) console.error('Error deleting household_chores:', deleteChoresError);

    // Delete messages
    const { error: deleteMessagesError } = await supabase
      .from('messages')
      .delete()
      .eq('household_id', householdId);
    if (deleteMessagesError) console.error('Error deleting messages:', deleteMessagesError);

    // Delete invitations
    const { error: deleteInvitesError } = await supabase
      .from('invitations')
      .delete()
      .eq('household_id', householdId);
    if (deleteInvitesError) console.error('Error deleting invitations:', deleteInvitesError);

    // Delete household members
    const { error: deleteMembersError } = await supabase
      .from('household_members')
      .delete()
      .eq('household_id', householdId);

    if (deleteMembersError) {
      console.error('Error deleting household_members:', deleteMembersError);
      return NextResponse.json({ error: 'Failed to delete household membership record.' }, { status: 500 });
    }

    // Finally, delete the household itself
    const { error: deleteHouseholdError } = await supabase
      .from('households')
      .delete()
      .eq('id', householdId);

    if (deleteHouseholdError) {
      console.error('Error deleting household:', deleteHouseholdError);
      return NextResponse.json({ error: 'Failed to delete household record.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Household deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/households/[id]:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete household';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
