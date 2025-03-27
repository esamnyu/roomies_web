// src/app/api/households/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Removed Prisma import
// import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Ensure this path is correct
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Helper function to create Supabase client in Route Handlers
// Ensure you have a similar setup or import from a shared lib
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
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle potential errors during cookie setting (e.g., read-only headers)
            console.error("Error setting cookie:", name, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handle potential errors during cookie removal
            console.error("Error removing cookie:", name, error);
          }
        },
      },
    }
  );
}

// Helper: Check household membership and optionally admin role
// Returns { authorized: boolean, membership?: any, error?: string, status?: number }
async function checkHouseholdAccess(supabase: any, householdId: string, userId: string, requireAdmin = false) {
    const { data: membership, error } = await supabase
      .from('HouseholdUser')
      .select('userId, role') // Select role for admin check
      .eq('userId', userId)
      .eq('householdId', householdId)
      .single(); // Expecting one record or null/error

    if (error) {
        console.error("Error checking household membership:", householdId, userId, error);
        // Distinguish between "not found" (handled below) and other errors
        if (error.code === 'PGRST116') { // code for "No rows returned"
             return { authorized: false, error: 'You are not a member of this household.', status: 403 };
        }
        return { authorized: false, error: 'Failed to verify household membership.', status: 500 };
    }
    // PGRST116 should handle not found, but safety check
    if (!membership) {
        return { authorized: false, error: 'You are not a member of this household.', status: 403 };
    }
    if (requireAdmin && membership.role !== 'ADMIN') {
        return { authorized: false, error: 'Only household admins can perform this action.', status: 403 };
    }
    // Return the membership object which contains the role
    return { authorized: true, membership };
}


// GET /api/households/[id] - Get a specific household's details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseRouteHandlerClient();
  try {
    const { data: { session }, error: sessionError } = await (await supabase).auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const householdId = params.id;
    if (!householdId) return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });

    // 1. Check if user is a member of the household
    const accessCheck = await checkHouseholdAccess(supabase, householdId, session.user.id);
    if (!accessCheck.authorized) {
        return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    // 2. Get the household with related data (basic example)
    // Fetching limited/filtered related data might require multiple queries or a DB function
    const { data: household, error: fetchError } = await (await supabase)
      .from('Household')
      .select(`
        *,
        members:HouseholdUser(
            *,
            user:User!userId(id, name, email, avatar)
        ),
        expenses:Expense( * ),
        tasks:Task( * ),
        messages:Message( * ),
        rules:HouseRule( * )
      `)
      .eq('id', householdId)
      .single(); // Expect one household

    if (fetchError) {
        console.error('Error fetching household details:', fetchError);
        // Check if it's a "not found" error
        if (fetchError.code === 'PGRST116') {
             return NextResponse.json({ error: 'Household not found.' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to fetch household details.' }, { status: 500 });
    }
     if (!household) { // Should be caught by PGRST116, but safety check
      return NextResponse.json({ error: 'Household not found.' }, { status: 404 });
    }

     // You might want to manually limit related data here if needed, e.g.:
     // household.expenses = household.expenses?.slice(0, 5);
     // household.tasks = household.tasks?.filter(t => t.status !== 'COMPLETED').slice(0, 5);


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
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseRouteHandlerClient();
  try {
    const { data: { session }, error: sessionError } = await (await supabase).auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const householdId = params.id;
    if (!householdId) return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });

    // 1. Check if user is an ADMIN of the household
    const accessCheck = await checkHouseholdAccess(supabase, householdId, session.user.id, true); // requireAdmin = true
    if (!accessCheck.authorized) {
        return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    // 2. Get update data from request body
    const body = await request.json();
    const { name, address } = body;

    // Prepare update data, only include fields that are provided
    const updateData: { name?: string, address?: string | null, updatedAt: string } = {
        updatedAt: new Date().toISOString() // Always update updatedAt timestamp
    };
    if (name !== undefined) {
        if (typeof name !== 'string' || name.trim() === '') {
            return NextResponse.json({ error: 'Household name cannot be empty' }, { status: 400 });
        }
        updateData.name = name.trim();
    }
    if (address !== undefined) {
        // Allow setting address to null or a non-empty string
        updateData.address = (typeof address === 'string' && address.trim() !== '') ? address.trim() : null;
    }

     // Check if there's anything to update besides the timestamp
     if (Object.keys(updateData).length <= 1) {
        // If only updatedAt is present, maybe return current data or 304 Not Modified?
        // Or return an error indicating nothing was changed.
        return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 });
     }


    // 3. Update the household
    const { data: updatedHousehold, error: updateError } = await (await supabase)
      .from('Household')
      .update(updateData)
      .eq('id', householdId)
      .select() // Select the updated household data
      .single();

     if (updateError) {
        console.error('Error updating household:', updateError);
        // Check for specific errors like not found if needed
        if (updateError.code === 'PGRST116') {
            return NextResponse.json({ error: 'Household not found.' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to update household.' }, { status: 500 });
     }
      if (!updatedHousehold) {
        // Should not happen if update was successful and no error, but check anyway
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
  { params }: { params: { id: string } }
) {
    const supabase = createSupabaseRouteHandlerClient();
    try {
      const { data: { session }, error: sessionError } = await (await supabase).auth.getSession();
      if (sessionError) throw new Error(sessionError.message);
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const householdId = params.id;
      if (!householdId) return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });

      // 1. Check if user is an ADMIN of the household
      const accessCheck = await checkHouseholdAccess(supabase, householdId, session.user.id, true); // requireAdmin = true
      if (!accessCheck.authorized) {
          return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
      }

      // 2. Count members - prevent deletion if other members exist (safer default)
      const { count: membersCount, error: countError } = await (await supabase)
        .from('HouseholdUser')
        .select('*', { count: 'exact', head: true })
        .eq('householdId', householdId);

      if (countError) {
           console.error('Error counting household members:', countError);
           return NextResponse.json({ error: 'Failed to verify member count before deletion.' }, { status: 500 });
      }

      // Check if the count is null (shouldn't happen but safety check) or greater than 1
      if (membersCount === null || membersCount > 1) {
        return NextResponse.json({
          error: `Cannot delete household with ${membersCount ?? '?'} members. Remove other members first.`
        }, { status: 400 });
      }
       // If count is 1, it must be the current admin user


      // --- Transaction Start (Conceptual - Use Supabase Function for real transaction) ---
      console.warn(`Executing household ${householdId} deletion WITHOUT a database transaction. Use a DB function for production.`);

      // 3. Delete related records (order might matter based on constraints)
      // IMPORTANT: Add deletion for ALL related tables (Tasks, Messages, Rules, Expenses, Payments, Splits, Invitations etc.)

      // Fetch Expense IDs first
      const { data: expensesToDelete, error: expenseIdsError } = await (await supabase)
        .from('Expense')
        .select('id')
        .eq('householdId', householdId);

      if (expenseIdsError) {
        console.error("Error fetching expense IDs for deletion:", expenseIdsError);
        return NextResponse.json({ error: 'Failed to get related expense IDs.' }, { status: 500 });
      }

      // Check if there are any expenses before attempting to delete related items
      if (expensesToDelete && expensesToDelete.length > 0) {
        const expenseIds = expensesToDelete.map(e => e.id); // Extract IDs into an array

        // Now use the array of IDs in the .in() filter
        const { error: deleteSplitsError } = await (await supabase).from('ExpenseSplit').delete().in('expenseId', expenseIds);
        if (deleteSplitsError) console.error("Error deleting ExpenseSplits:", deleteSplitsError); // Log error, continue cleanup

        const { error: deletePaymentsError } = await (await supabase).from('Payment').delete().in('expenseId', expenseIds);
         if (deletePaymentsError) console.error("Error deleting Payments:", deletePaymentsError); // Log error, continue cleanup

        // Delete the Expenses themselves after related items
        const { error: deleteExpensesError } = await (await supabase).from('Expense').delete().in('id', expenseIds);
         if (deleteExpensesError) console.error("Error deleting Expenses:", deleteExpensesError); // Log error, continue cleanup
      } else {
        console.log(`No expenses found for household ${householdId} to delete related data for.`);
      }

      // ... add deletes for Task, Message, HouseRule, Invitation, etc. ...
      // Example:
      const { error: deleteTasksError } = await (await supabase).from('Task').delete().eq('householdId', householdId);
      if (deleteTasksError) console.error("Error deleting Tasks:", deleteTasksError);

      const { error: deleteMessagesError } = await (await supabase).from('Message').delete().eq('householdId', householdId);
       if (deleteMessagesError) console.error("Error deleting Messages:", deleteMessagesError);

       const { error: deleteRulesError } = await (await supabase).from('HouseRule').delete().eq('householdId', householdId);
       if (deleteRulesError) console.error("Error deleting HouseRules:", deleteRulesError);

       const { error: deleteInvitesError } = await (await supabase).from('Invitation').delete().eq('householdId', householdId);
       if (deleteInvitesError) console.error("Error deleting Invitations:", deleteInvitesError);


      // Finally, delete HouseholdUser entries (should only be the admin left)
      const { error: deleteMembersError } = await (await supabase).from('HouseholdUser').delete().eq('householdId', householdId);
       if (deleteMembersError) {
            console.error("Error deleting HouseholdUsers:", deleteMembersError);
            // This is critical, if this fails, the household delete might fail too.
            return NextResponse.json({ error: 'Failed to delete household membership record.' }, { status: 500 });
       }


      // 4. Delete the household itself
      const { data: deletedHousehold, error: deleteHouseholdError } = await (await supabase)
        .from('Household')
        .delete()
        .eq('id', householdId)
        .select() // Optionally select the deleted row (or just check error)
        .maybeSingle(); // Use maybeSingle in case it was already deleted

      if (deleteHouseholdError) {
        console.error('Error deleting household:', deleteHouseholdError);
         // If the household delete failed, related data might be partially deleted (BAD)
        return NextResponse.json({ error: 'Failed to delete household record. Related data might be inconsistent.' }, { status: 500 });
      }
      if (!deletedHousehold && !deleteHouseholdError){
        // This case means the household didn't exist when delete was attempted.
        // Could be considered success or a 404 depending on desired behavior.
        console.log(`Household ${householdId} not found during delete, potentially already deleted.`);
         // Returning success as the end state (household gone) is achieved.
      }
      // --- Transaction End (Conceptual) ---


      return NextResponse.json({ message: 'Household deleted successfully' });

    } catch (error) {
      console.error('Error in DELETE /api/households/[id]:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete household';
      return NextResponse.json({ error: message }, { status: 500 });
    }
}

// NOTE: Member management endpoints (POST add, PATCH role, DELETE member)
// were in the original Prisma file but should ideally be in separate routes
// like /api/households/[id]/members and /api/households/[id]/members/[userId]
// They would need similar refactoring using Supabase.