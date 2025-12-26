// src/app/api/users/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options'; // Ensure path is correct
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
// Import the admin client for Supabase Auth user deletion
import { supabase as supabaseAdmin } from '@/lib/supabase'; // Assuming this is the admin client

// Helper function (ensure cookies() is correctly imported and used)
const createSupabaseRouteHandlerClient = async () => {
  const cookieStore = await cookies(); // Correct usage inside function scope
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }); } catch (error) { console.error("Error setting cookie:", name, error); } },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }); } catch (error) { console.error("Error removing cookie:", name, error); } },
      },
    }
  );
}

// GET /api/users/me - Get current user's details
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseRouteHandlerClient(); // Use non-async call
  try {
    // Use supabase client created by helper
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;

    // 1. Get the user's core details
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, name, email, avatar, createdAt') // Select columns from your User table
      .eq('id', userId)
      .single();

    if (userError) {
        console.error("Error fetching user data:", userError);
        if (userError.code === 'PGRST116') return NextResponse.json({ error: 'User not found' }, { status: 404 });
        return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }
    // PGRST116 should catch not found, but double-check
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });


    // 2. Get household memberships with household details
    const { data: memberships, error: membershipsError } = await supabase
        .from('household_members')
        .select(`
            role,
            joinedAt,
            household:Household!inner(id, name, address, createdAt)
        `)
        .eq('user_id', userId)
        .order('joined_at', { referencedTable: 'HouseholdUser', ascending: false }); // Order by joinedAt in HouseholdUser

     if (membershipsError) {
        console.error("Error fetching user households:", membershipsError);
        // Don't fail the whole request, return user data without households
     }

     // 3. Get counts (examples - adjust fields/tables as needed for MVP)
     const { count: paymentCount, error: paymentCountError } = await supabase
        .from('Payment')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
     if(paymentCountError) console.error("Error counting payments:", paymentCountError);

      const { count: expenseCreatedCount, error: expenseCountError } = await supabase
        .from('Expense')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userId);
      if(expenseCountError) console.error("Error counting created expenses:", expenseCountError);

       // Task count might be less critical for expense MVP, include if needed
       /*
       const { count: tasksAssignedCount, error: tasksAssignedError } = await supabase
        .from('Task')
        .select('*', { count: 'exact', head: true })
        .eq('assigneeId', userId);
       if(tasksAssignedError) console.error("Error counting assigned tasks:", tasksAssignedError);
       */


    // Format user data for response
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      created_at: user.createdAt,
      // Include actual settings if stored, otherwise omit or use defaults
      // settings: { ... },
      statistics: {
        // Use actual counts, default to 0 if error or null
        paymentsMadeOrReceived: paymentCount ?? 0, // Assuming this counts payments where user is 'userId'
        expensesCreated: expenseCreatedCount ?? 0,
        // tasksAssigned: tasksAssignedCount ?? 0, // Include if fetched
        // Add other relevant counts here
      },
      // Map memberships, handle potential null from error
      // Supabase types foreign key joins as arrays, handle both cases
      households: (memberships || []).map(m => {
        const household = Array.isArray(m.household) ? m.household[0] : m.household;
        return {
          id: household?.id,
          name: household?.name,
          address: household?.address,
          created_at: household?.createdAt,
          joined_at: m.joinedAt,
          role: m.role,
        };
      }).filter(h => h.id), // Filter out any potential null households if join failed
    };

    return NextResponse.json(userData);
  } catch (error) {
    console.error('Error in GET /api/users/me:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch user data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/users/me - Delete current user's account (MVP Version)
export async function DELETE(request: NextRequest) {
  // **************************************************************************
  // ** WARNING: MVP IMPLEMENTATION - LACKS TRANSACTIONAL SAFETY & FULL CLEANUP **
  // ** Related data (Expenses, Tasks etc.) WILL BE ORPHANED.              **
  // ** Use a Supabase Database Function for production account deletion.   **
  // **************************************************************************
  const supabase = await createSupabaseRouteHandlerClient(); // Use non-async call
  try {
    // Use supabase client created by helper
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;
    console.warn(`Executing MVP DELETE for user ${userId}. Data orphaning will occur. Use a DB function for production.`);

    // --- Sole Admin Check ---
    // 1. Get households where the user is ADMIN
    const { data: adminMemberships, error: adminCheckError } = await supabase
        .from('household_members')
        // Select householdId and name for error message
        .select('householdId, household:Household!inner(id, name)') // Fetch household data
        .eq('user_id', userId)
        .eq('role', 'admin');

    if (adminCheckError) {
         console.error("Error fetching admin memberships:", adminCheckError);
         return NextResponse.json({ error: 'Failed to check admin status.' }, { status: 500 });
    }

    // 2. Check each admin membership
    if (adminMemberships && adminMemberships.length > 0) {
        const problematicHouseholds = [];
        for (const membership of adminMemberships) {
            // --- Incorporating the fix ---
            // Supabase types foreign key joins as arrays, handle both cases
            const householdData = Array.isArray(membership.household) ? membership.household[0] : membership.household;
            if (!householdData) {
                console.warn(`Membership record found for user ${userId} but household data is missing.`);
                continue;
            }
            const householdId = membership.householdId;
            const householdName = householdData.name; // Use the intermediate variable
            // --- End Fix ---

            // Count total members in this household
             const { count: totalMemberCount, error: totalCountErr } = await supabase
                .from('household_members')
                .select('*', { count: 'exact', head: true })
                .eq('household_id', householdId);

             if (totalCountErr || totalMemberCount === null) {
                console.error(`Error counting total members for household ${householdId}:`, totalCountErr);
                // Use the variable for the name in the error message
                return NextResponse.json({ error: `Failed to check member count for household ${householdName}.` }, { status: 500 });
             }

             // If household has more than one member (the user being deleted)
             if (totalMemberCount > 1) {
                 // Count *other* admins in this household
                 const { count: otherAdminCount, error: otherAdminErr } = await supabase
                    .from('household_members')
                    .select('*', { count: 'exact', head: true })
                    .eq('household_id', householdId)
                    .eq('role', 'admin')
                    .neq('userId', userId); // Exclude the current user

                 if (otherAdminErr || otherAdminCount === null) {
                    console.error(`Error counting other admins for household ${householdId}:`, otherAdminErr);
                    // Use the variable for the name in the error message
                    return NextResponse.json({ error: `Failed to check other admins for household ${householdName}.` }, { status: 500 });
                 }

                 // If there are no other admins in this multi-member household
                 if (otherAdminCount === 0) {
                     // Use the variable for the name
                     problematicHouseholds.push(householdName || householdId);
                 }
             }
        } // end for loop

        // If the user is the sole admin of any multi-member households, prevent deletion
        if (problematicHouseholds.length > 0) {
            return NextResponse.json({
                error: 'You are the only admin of one or more households with other members. Please transfer admin rights or remove other members first.',
                households: problematicHouseholds,
              }, { status: 400 }); // 400 Bad Request is appropriate here
        }
    }
    // --- End Sole Admin Check ---


    // --- MVP Deletion Steps (Non-Transactional, Incomplete Cleanup) ---

    // 1. Delete HouseholdUser memberships
    console.warn(`Deleting HouseholdUser records for user ${userId}.`);
    const { error: deleteMembershipsError } = await supabase
        .from('household_members')
        .delete()
        .eq('user_id', userId);
    if (deleteMembershipsError) {
        console.error("Error deleting user memberships:", deleteMembershipsError);
        // Proceeding anyway for MVP, but this is risky
    }

    // 2. **SKIPPING Deletion of related data (Expenses, Payments, Tasks etc.) for MVP**
    console.warn(`SKIPPING deletion of Expenses, Payments, Tasks etc. for user ${userId}. Data will be orphaned.`);
    // For Production: Add calls here (within a DB function) to delete/handle:
    // - Payments where userId = user.id
    // - ExpenseSplits where userId = user.id
    // - Expenses where creatorId = user.id (or reassign?)
    // - Tasks where creatorId or assigneeId = user.id (delete/unassign?)
    // - Messages where senderId = user.id
    // - Invitations sent by or to the user
    // - Any other user-related data

    // 3. Delete the user from the 'User' table
    console.warn(`Deleting user record from User table for ${userId}.`);
    const { error: deleteUserTableError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
     if (deleteUserTableError) {
        console.error("Error deleting user from User table:", deleteUserTableError);
        // If this fails, the auth user might still exist.
        return NextResponse.json({ error: 'Failed to delete user profile data.' }, { status: 500 });
    }

    // 4. Delete the user from Supabase Auth (Requires Admin Client)
    console.warn(`Deleting user from Supabase Auth for ${userId}. Requires Admin privileges.`);
    // Ensure supabaseAdmin is correctly initialized with the service role key
    // Add a check to ensure supabaseAdmin is available
    if (!supabaseAdmin || typeof supabaseAdmin.auth?.admin?.deleteUser !== 'function') {
        console.error("CRITICAL: Supabase Admin Client (supabaseAdmin) is not configured or available. Cannot delete Auth user.");
        // Optionally revert the User table deletion if possible (difficult without transaction)
        return NextResponse.json({ error: 'User data deleted, but Admin client not configured to delete authentication record. Requires manual cleanup.' }, { status: 500 });
    }

    const { data: authDeleteData, error: deleteAuthUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthUserError) {
        console.error("CRITICAL: Error deleting user from Supabase Auth:", deleteAuthUserError);
        // The user record in your 'User' table might be deleted, but the auth user still exists.
        // This requires manual cleanup in Supabase dashboard.
        return NextResponse.json({ error: 'User data deleted, but failed to delete authentication record. Requires manual cleanup.' }, { status: 500 });
    }

    console.log(`Successfully initiated deletion process for user ${userId}. MVP cleanup done. Auth user deleted:`, authDeleteData);
    // --- End MVP Deletion Steps ---


    // TODO: Sign the user out on the client-side after this request succeeds.
    return NextResponse.json({ message: 'Account deletion process initiated successfully. Related data (expenses, tasks etc.) may be orphaned in this MVP version.' });

  } catch (error) {
    console.error('Error in DELETE /api/users/me:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete account';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}