// src/app/api/users/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Removed Prisma import
// import { prisma } from '@/lib/prisma';
// Removed NextAuth imports
// import { getServerSession } from 'next-auth';
// import { authOptions } from '@/app/api/auth/[...nextauth]/route';
// Import the standardized Supabase client helper
import { createServerSupabaseClient } from '@/lib/supabase-ssr'; // Using 'supbase' based on context file list
import { type CookieOptions } from '@supabase/ssr'; // Import CookieOptions if not already global/implied
// Import the admin client specifically for Supabase Auth user deletion
import { supabase as supabaseAdmin } from '@/lib/supabase'; // Assuming this is the admin client

// Removed local helper function - use imported createServerSupabaseClient instead
/*
const createSupabaseRouteHandlerClient = async () => {
  // ... implementation ...
}
*/

// GET /api/users/me - Get current user's details
export async function GET(request: NextRequest) {
  // Use the imported standardized helper
  const supabase = await createServerSupabaseClient();
  try {
    // Use supabase client created by helper
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    // Add error handling for session retrieval
    if (sessionError) {
        console.error('Error getting session:', sessionError);
        // Use a more specific error message if possible
        const message = sessionError.message || 'Failed to retrieve session.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;

    // 1. Get the user's core details
    // Use the 'supabase' instance from the helper
    const { data: user, error: userError } = await supabase
      .from('User')
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
    // Use the 'supabase' instance from the helper
    const { data: memberships, error: membershipsError } = await supabase
        .from('HouseholdUser')
        .select(`
            role,
            joinedAt,
            household:Household!inner(id, name, address, createdAt)
        `)
        .eq('userId', userId)
        .order('joinedAt', { referencedTable: 'HouseholdUser', ascending: false }); // Order by joinedAt in HouseholdUser

     if (membershipsError) {
        console.error("Error fetching user households:", membershipsError);
        // Don't fail the whole request, return user data without households
     }

     // 3. Get counts (examples - adjust fields/tables as needed for MVP)
     // Use the 'supabase' instance from the helper
     const { count: paymentCount, error: paymentCountError } = await supabase
        .from('Payment')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userId);
     if(paymentCountError) console.error("Error counting payments:", paymentCountError);

      // Use the 'supabase' instance from the helper
      const { count: expenseCreatedCount, error: expenseCountError } = await supabase
        .from('Expense')
        .select('*', { count: 'exact', head: true })
        .eq('creatorId', userId);
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
      createdAt: user.createdAt,
      // Include actual settings if stored, otherwise omit or use defaults
      // settings: { ... },
      statistics: {
        // Use actual counts, default to 0 if error or null
        paymentsMadeOrReceived: paymentCount ?? 0,
        expensesCreated: expenseCreatedCount ?? 0,
        // tasksAssigned: tasksAssignedCount ?? 0, // Include if fetched
      },
      // Map memberships, handle potential null from error
      // *** MODIFICATION START: Handle 'household' potentially inferred as array ***
      households: (memberships || []).map((m: any) => { // Use 'any' here or a type where household is T[]
          // Safely access the first element if TS thinks 'household' is an array
          const hh = Array.isArray(m.household) ? m.household[0] : m.household;
          // If it's guaranteed to be an object (as !inner suggests), simpler: const hh = m.household;
          return {
              id: hh?.id,
              name: hh?.name,
              address: hh?.address,
              createdAt: hh?.createdAt,
              joinedAt: m.joinedAt,
              role: m.role,
          };
      }).filter((h: { id?: string }) => h.id), // Filter out entries without a valid household ID
      // *** MODIFICATION END ***
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
  // Use the imported standardized helper for session checking and public table access
  const supabase = await createServerSupabaseClient();
  try {
    // Use supabase client created by helper to get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

     // Add error handling for session retrieval
    if (sessionError) {
        console.error('Error getting session:', sessionError);
        const message = sessionError.message || 'Failed to retrieve session.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;
    console.warn(`Executing MVP DELETE for user ${userId}. Data orphaning will occur. Use a DB function for production.`);

    // --- Sole Admin Check ---
    // Use the 'supabase' instance from the helper
    // 1. Get households where the user is ADMIN
    const { data: adminMemberships, error: adminCheckError } = await supabase
        .from('HouseholdUser')
        // Select householdId and name for error message
        .select('householdId, household:Household!inner(id, name)') // Fetch household data
        .eq('userId', userId)
        .eq('role', 'ADMIN');

    if (adminCheckError) {
         console.error("Error fetching admin memberships:", adminCheckError);
         return NextResponse.json({ error: 'Failed to check admin status.' }, { status: 500 });
    }

    // 2. Check each admin membership
    if (adminMemberships && adminMemberships.length > 0) {
        const problematicHouseholds = [];
        for (const membership of adminMemberships) {
            // --- Incorporating the fix ---
            const household = membership.household; // Assign to intermediate variable
            if (!household) {
                console.warn(`Membership record found for user ${userId} but household data is missing.`);
                continue;
            }
            // Handle case where household might be inferred as array
            const hh = Array.isArray(household) ? household[0] : household;
            if (!hh) {
                console.warn(`Membership record found for user ${userId} but household data is missing or empty array.`);
                continue;
            }

            const householdId = membership.householdId;
            const householdName = hh.name; // Use the potentially extracted object
            // --- End Fix ---

            // Count total members in this household
            // Use the 'supabase' instance from the helper
             const { count: totalMemberCount, error: totalCountErr } = await supabase
                .from('HouseholdUser')
                .select('*', { count: 'exact', head: true })
                .eq('householdId', householdId);

             if (totalCountErr || totalMemberCount === null) {
                console.error(`Error counting total members for household ${householdId}:`, totalCountErr);
                // Use the variable for the name in the error message
                return NextResponse.json({ error: `Failed to check member count for household ${householdName}.` }, { status: 500 });
             }

             // If household has more than one member (the user being deleted)
             if (totalMemberCount > 1) {
                 // Count *other* admins in this household
                 // Use the 'supabase' instance from the helper
                 const { count: otherAdminCount, error: otherAdminErr } = await supabase
                    .from('HouseholdUser')
                    .select('*', { count: 'exact', head: true })
                    .eq('householdId', householdId)
                    .eq('role', 'ADMIN')
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
    // Use the 'supabase' instance from the helper
    console.warn(`Deleting HouseholdUser records for user ${userId}.`);
    const { error: deleteMembershipsError } = await supabase
        .from('HouseholdUser')
        .delete()
        .eq('userId', userId);
    if (deleteMembershipsError) {
        console.error("Error deleting user memberships:", deleteMembershipsError);
        // Proceeding anyway for MVP, but this is risky
    }

    // 2. **SKIPPING Deletion of related data (Expenses, Payments, Tasks etc.) for MVP**
    console.warn(`SKIPPING deletion of Expenses, Payments, Tasks etc. for user ${userId}. Data will be orphaned.`);
    // For Production: Add calls here (within a DB function) to delete/handle related data

    // 3. Delete the user from the 'User' table
    // Use the 'supabase' instance from the helper
    console.warn(`Deleting user record from User table for ${userId}.`);
    const { error: deleteUserTableError } = await supabase
        .from('User')
        .delete()
        .eq('id', userId);
     if (deleteUserTableError) {
        console.error("Error deleting user from User table:", deleteUserTableError);
        // If this fails, the auth user might still exist.
        return NextResponse.json({ error: 'Failed to delete user profile data.' }, { status: 500 });
    }

    // 4. Delete the user from Supabase Auth (Requires Admin Client)
    console.warn(`Deleting user from Supabase Auth for ${userId}. Requires Admin privileges.`);
    // Use the imported 'supabaseAdmin' client here
    if (!supabaseAdmin || typeof supabaseAdmin.auth?.admin?.deleteUser !== 'function') {
        console.error("CRITICAL: Supabase Admin Client (supabaseAdmin) is not configured or available. Cannot delete Auth user.");
        return NextResponse.json({ error: 'User data deleted, but Admin client not configured to delete authentication record. Requires manual cleanup.' }, { status: 500 });
    }

    const { data: authDeleteData, error: deleteAuthUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthUserError) {
        console.error("CRITICAL: Error deleting user from Supabase Auth:", deleteAuthUserError);
        return NextResponse.json({ error: 'User data deleted, but failed to delete authentication record. Requires manual cleanup.' }, { status: 500 });
    }

    console.log(`Successfully initiated deletion process for user ${userId}. MVP cleanup done. Auth user deleted:`, authDeleteData);
    // --- End MVP Deletion Steps ---


    // TODO: Sign the user out on the client-side after this request succeeds.
    return NextResponse.json({ message: 'Account deletion process initiated successfully. Related data (expenses, tasks etc.) may be orphaned in this MVP version.' });

  } catch (error) {
    console.error('Error in DELETE /api/users/me:', error);
    // Ensure error handling catches potential issues from createServerSupabaseClient if it throws
    const message = error instanceof Error ? error.message : 'Failed to delete account';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}