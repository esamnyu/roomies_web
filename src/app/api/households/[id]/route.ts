// src/app/api/households/[id]/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Removed unused Supabase client creation imports from '@supabase/ssr' & 'next/headers' as they are handled by the helper
// import { createServerClient, type CookieOptions } from '@supabase/ssr';
// import { cookies } from 'next/headers';
// Import the standardized Supabase client helper
import { createServerSupabaseClient } from '@/lib/supabase-ssr'; // Adjust path if needed, using 'supbase' based on context
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // Keep CookieOptions if needed elsewhere, though likely not needed here directly
import { generateUUID } from '@/lib/utils'; // Assuming you have this utility

// --- Removed local helper function ---
/*
const createSupabaseClient = async () => {
    // ... implementation ...
}
*/

// --- Interfaces (kept as is) ---
interface UserData {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    createdAt: string; // Assuming User table provides this
}

interface HouseholdMemberQueryResult {
    id: string; // HouseholdUser ID
    userId: string;
    role: string;
    joinedAt: string;
    user: UserData | null; // User might be null if join fails or user deleted
}

interface FormattedMember {
    id: string; // HouseholdUser ID
    userId: string;
    role: string;
    joinedAt: string;
    name: string;
    email: string;
    avatar: string | null;
    createdAt: string; // User's creation date
}

// --- Route Handlers ---

// GET /api/households/[id]/members - Get all members of a household
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // Use the correct parameter name
    const householdId = params.id;

    console.log(`API: Fetching members for household ID: ${householdId}`);

    if (!householdId || householdId === 'undefined') {
        console.error('Invalid household ID:', householdId);
        return NextResponse.json({ error: 'Valid household ID required' }, { status: 400 });
    }

    // Use the imported standardized helper
    let supabase;
    try {
        supabase = await createServerSupabaseClient();
    } catch (error) {
        // Error during client creation is logged in the helper
        return NextResponse.json({ error: 'Internal server error during client setup' }, { status: 500 });
    }

    try {
        // Get session using the SAME client instance
        console.log('Attempting to get session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            console.error('Session error:', sessionError);
            return NextResponse.json({
                error: 'Failed to process session',
                details: sessionError.message
            }, { status: 500 });
        }

        // --- START: Admin Bypass Logic (Keep or remove based on production needs) ---
        if (!session) {
            console.error('No session found - Unauthorized');
            // Decide if admin bypass is intended for production or just testing
            // If keeping: Ensure SUPABASE_SERVICE_ROLE_KEY is set and handled securely
            console.log('No auth session found, using admin client as fallback for testing');

            // Create an admin client (consider moving this logic to a helper if reused)
             const supabaseAdmin = createServerClient( // Use createServerClient from @supabase/ssr directly
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                {
                    auth: { persistSession: false, autoRefreshToken: false },
                    // No cookie handlers needed for admin client relying purely on service key
                    cookies: { get: () => undefined, set: () => {}, remove: () => {} }
                }
            );

            // Fetch members directly with admin privileges
            const { data, error: adminError } = await supabaseAdmin
                .from('HouseholdUser')
                .select(`
                    id, userId, role, joinedAt,
                    user:User!userId( id, name, email, avatar, createdAt )
                `)
                .eq('householdId', householdId)
                .order('joinedAt', { ascending: false });

            if (adminError) {
                console.error("Error fetching with admin:", adminError);
                return NextResponse.json({ error: 'Failed to fetch data (admin bypass)' }, { status: 500 });
            }

            // Format the data as before
             const formattedMembers: FormattedMember[] = [];
             if (data && Array.isArray(data)) {
                 const queryResults = data as unknown as HouseholdMemberQueryResult[];
                 for (const member of queryResults) {
                     if (member && member.user && member.user.id && member.user.name && member.user.email) {
                         const userData = member.user;
                         formattedMembers.push({
                             id: member.id,
                             userId: member.userId,
                             role: member.role,
                             joinedAt: member.joinedAt,
                             name: userData.name,
                             email: userData.email,
                             avatar: userData.avatar,
                             createdAt: userData.createdAt
                         });
                     } else {
                          console.warn(`(Admin Bypass) Skipping member formatting due to missing data for HouseholdUser ID: ${member?.id}, User ID: ${member?.userId}`);
                     }
                 }
             }

            console.log(`Admin bypass: Found ${formattedMembers.length} members`);
            return NextResponse.json(formattedMembers);
        }
        // --- END: Admin Bypass Logic ---

        // --- START: Regular Authenticated Flow (if session exists) ---
        console.log(`Authenticated user: ${session.user.id} for household: ${householdId}`);

        // Check membership using the SAME client instance from the helper
        const { data: membership, error: membershipError } = await supabase
            .from('HouseholdUser')
            .select('userId, role')
            .eq('userId', session.user.id)
            .eq('householdId', householdId)
            .maybeSingle();

        if (membershipError) {
            console.error("Membership check error:", membershipError);
            return NextResponse.json({ error: 'Failed to verify membership' }, { status: 500 });
        }

        if (!membership) {
            console.error(`User ${session.user.id} is not a member of household ${householdId}`);
            return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
        }

        console.log(`User role in household: ${membership.role}`);

        // Get members using the SAME client instance from the helper
        const { data, error: membersError } = await supabase
            .from('HouseholdUser')
            .select(`
                id, userId, role, joinedAt,
                user:User!userId( id, name, email, avatar, createdAt )
            `)
            .eq('householdId', householdId)
            .order('joinedAt', { ascending: false });

        if (membersError) {
            console.error('Error fetching household members:', membersError);
            return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
        }

        console.log(`Found ${data?.length || 0} members for household ${householdId}`);

        // Format the member data for response
        const formattedMembers: FormattedMember[] = [];
        if (data && Array.isArray(data)) {
            const queryResults = data as unknown as HouseholdMemberQueryResult[];
            for (const member of queryResults) {
                // Ensure user data is present before formatting
                if (member && member.user && member.user.id && member.user.name && member.user.email) {
                    const userData = member.user;
                    formattedMembers.push({
                        id: member.id,
                        userId: member.userId,
                        role: member.role,
                        joinedAt: member.joinedAt,
                        name: userData.name,
                        email: userData.email,
                        avatar: userData.avatar,
                        createdAt: userData.createdAt
                    });
                } else {
                    console.warn(`Skipping member formatting due to missing data for HouseholdUser ID: ${member?.id}, User ID: ${member?.userId}`);
                }
            }
        }

        return NextResponse.json(formattedMembers);
         // --- END: Regular Authenticated Flow ---

    } catch (error) {
        console.error('Error fetching household members (outer catch):', error);
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to fetch household members', details: message }, { status: 500 });
    }
}

// POST /api/households/[id]/members - Add a member to the household (Manual Add)
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // Use the correct parameter name
    const householdId = params.id;

    // Use the imported standardized helper
    let supabase;
    try {
        supabase = await createServerSupabaseClient();
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error during client setup' }, { status: 500 });
    }

    try {
        // Get session using the SAME client instance
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            console.error('Session error:', sessionError);
            return NextResponse.json({
                error: 'Failed to process session',
                details: sessionError.message
            }, { status: 500 });
        }

        if (!session) {
            console.error('No session found - Unauthorized');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log(`Authenticated user (POST): ${session.user.id} for household: ${householdId}`);

        if (!householdId || householdId === 'undefined') {
            console.error('Invalid household ID:', householdId);
            return NextResponse.json({ error: 'Household ID required' }, { status: 400 });
        }

        let payload;
        try {
            payload = await request.json();
        } catch (e) {
            console.error('Invalid request body:', e);
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { email, role = 'MEMBER' } = payload;

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const validRoles = ['ADMIN', 'MEMBER', 'GUEST'];
        if (!validRoles.includes(role)) {
            return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
        }

        // Check admin permission using the SAME client instance
        const { data: currentMembership, error: membershipError } = await supabase
            .from('HouseholdUser')
            .select('userId, role')
            .eq('userId', session.user.id)
            .eq('householdId', householdId)
            .maybeSingle();

        if (membershipError) {
            console.error("Admin check error:", membershipError);
            return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
        }

        if (!currentMembership) {
             console.error(`User ${session.user.id} is not a member of household ${householdId} (POST)`);
            return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
        }

        if (currentMembership.role !== 'ADMIN') {
            console.warn(`User ${session.user.id} attempted POST without ADMIN role`);
            return NextResponse.json({ error: 'Only household admins can add members directly' }, { status: 403 });
        }

        // Find target user using the SAME client instance
        const { data: targetUser, error: userError } = await supabase
            .from('User') // Make sure your public user table is named 'User'
            .select('id, name, email')
            .eq('email', email)
            .maybeSingle();

        if (userError) {
            console.error("Target user lookup error:", userError);
            return NextResponse.json({ error: 'Failed to find user by email' }, { status: 500 });
        }

        if (!targetUser) {
            return NextResponse.json({ error: 'User with specified email not found' }, { status: 404 });
        }

        // Check existing membership using the SAME client instance
        const { data: existingMember, error: existingError } = await supabase
            .from('HouseholdUser')
            .select('id')
            .eq('userId', targetUser.id)
            .eq('householdId', householdId)
            .limit(1)
            .maybeSingle();

        if (existingError) {
            console.error("Existing member check error:", existingError);
            return NextResponse.json({ error: 'Failed to check existing membership' }, { status: 500 });
        }

        if (existingMember) {
            return NextResponse.json({ error: 'User is already a member of this household' }, { status: 409 });
        }

        // Add member using the SAME client instance
        const { data: newMember, error: addError } = await supabase
            .from('HouseholdUser')
            .insert({
                userId: targetUser.id,
                householdId: householdId,
                role: role as 'ADMIN' | 'MEMBER' | 'GUEST',
                joinedAt: new Date().toISOString()
            })
            .select(`
                id, userId, householdId, role, joinedAt,
                user:User!userId( id, name, email, avatar )
            `)
            .single();

        if (addError) {
            console.error('Error adding member to household:', addError);
            return NextResponse.json({ error: 'Failed to add member to household', details: addError.message }, { status: 500 });
        }

        if (!newMember) {
            console.error('Add member insert operation did not return data unexpectedly.');
            return NextResponse.json({ error: 'Failed to add member to household (no data returned)' }, { status: 500 });
        }
        console.log(`Successfully added member ${targetUser.id} to household ${householdId}`)
        return NextResponse.json(newMember, { status: 201 });
    } catch (error) {
        console.error('Error adding household member (outer catch):', error);
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to add household member', details: message }, { status: 500 });
    }
}


// PATCH /api/households/[id]/members?userId={memberUserId} - Update member role
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // Use the correct parameter name
     const householdId = params.id;

    // Use the imported standardized helper
    let supabase;
    try {
        supabase = await createServerSupabaseClient();
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error during client setup' }, { status: 500 });
    }

    try {
        // Get session using the SAME client instance
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            console.error('Session error:', sessionError);
            return NextResponse.json({
                error: 'Failed to process session',
                details: sessionError.message
            }, { status: 500 });
        }

        if (!session) {
            console.error('No session found - Unauthorized');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log(`Authenticated user (PATCH): ${session.user.id} for household: ${householdId}`);

        if (!householdId || householdId === 'undefined') {
            console.error('Invalid household ID:', householdId);
            return NextResponse.json({ error: 'Household ID required in path' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const targetUserId = searchParams.get('userId');

        if (!targetUserId) {
            console.error('No target userId provided in query params');
            return NextResponse.json({ error: 'Target userId required as query parameter' }, { status: 400 });
        }

        let payload;
        try {
            payload = await request.json();
        } catch (e) {
            console.error('Invalid request body:', e);
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { role } = payload;

        const validRoles = ['ADMIN', 'MEMBER', 'GUEST'];
        if (!role || !validRoles.includes(role)) {
            return NextResponse.json({ error: 'Invalid role specified in body' }, { status: 400 });
        }

        // Check admin permission using the SAME client instance
        const { data: currentMembership, error: adminCheckError } = await supabase
            .from('HouseholdUser')
            .select('userId, role')
            .eq('userId', session.user.id)
            .eq('householdId', householdId)
            .maybeSingle();

        if (adminCheckError) {
            console.error("Admin check error:", adminCheckError);
            return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
        }

        if (!currentMembership) {
            console.error(`User ${session.user.id} is not a member of household ${householdId} (PATCH)`);
            return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
        }

        if (currentMembership.role !== 'ADMIN') {
            console.warn(`User ${session.user.id} attempted PATCH without ADMIN role`);
            return NextResponse.json({ error: 'Only household admins can update member roles' }, { status: 403 });
        }

        if (targetUserId === session.user.id) {
             console.warn(`Admin ${session.user.id} attempted to change their own role via PATCH`);
            return NextResponse.json({ error: 'Admins cannot change their own role via this endpoint' }, { status: 400 });
        }

        // Update role using the SAME client instance
        const { data: updatedMember, error: updateError } = await supabase
            .from('HouseholdUser')
            .update({ role: role as 'ADMIN' | 'MEMBER' | 'GUEST' })
            .eq('userId', targetUserId)
            .eq('householdId', householdId)
            .select(`
                id, userId, householdId, role, joinedAt,
                user:User!userId( id, name, email, avatar )
            `)
            .single();

        if (updateError) {
            console.error('Error updating member role:', updateError);
            if (updateError.code === 'PGRST116') {
                return NextResponse.json({ error: 'Target member not found in this household, or update failed' }, { status: 404 });
            }
            return NextResponse.json({ error: 'Failed to update member role', details: updateError.message }, { status: 500 });
        }

        if (!updatedMember) {
            console.error('Update member role operation did not return data unexpectedly.');
            return NextResponse.json({ error: 'Failed to update member role (no data returned)' }, { status: 500 });
        }

        console.log(`Successfully updated role for user ${targetUserId} in household ${householdId} to ${role}`);
        return NextResponse.json(updatedMember);
    } catch (error) {
        console.error('Error updating member role (outer catch):', error);
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to update member role', details: message }, { status: 500 });
    }
}


// DELETE /api/households/[id]/members?userId={memberUserId} - Remove a member
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // Use the correct parameter name
    const householdId = params.id;

    // Use the imported standardized helper
    let supabase;
    try {
        supabase = await createServerSupabaseClient();
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error during client setup' }, { status: 500 });
    }

    try {
        // Get session using the SAME client instance
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            console.error('Session error:', sessionError);
             return NextResponse.json({
                error: 'Failed to process session',
                details: sessionError.message
            }, { status: 500 });
        }

        if (!session) {
            console.error('No session found - Unauthorized');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

         console.log(`Authenticated user (DELETE): ${session.user.id} for household: ${householdId}`);

        if (!householdId || householdId === 'undefined') {
            console.error('Invalid household ID:', householdId);
            return NextResponse.json({ error: 'Household ID required in path' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const targetUserId = searchParams.get('userId');

        if (!targetUserId) {
            console.error('No target userId provided in query params');
            return NextResponse.json({ error: 'Target userId required as query parameter' }, { status: 400 });
        }

        const isRemovingSelf = targetUserId === session.user.id;
        let isAdmin = false;

        // Check current user's membership and role using the SAME client instance
        const { data: currentMembership, error: membershipError } = await supabase
            .from('HouseholdUser')
            .select('userId, role')
            .eq('userId', session.user.id)
            .eq('householdId', householdId)
            .maybeSingle();

        if (membershipError) {
            console.error("Membership check error:", membershipError);
            return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
        }

        if (!currentMembership) {
            console.error(`User ${session.user.id} is not a member of household ${householdId} (DELETE)`);
            return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
        }

        isAdmin = currentMembership.role === 'ADMIN';

        // Authorization check: Must be removing self OR be an admin removing someone else
        if (!isRemovingSelf && !isAdmin) {
            console.warn(`User ${session.user.id} (role ${currentMembership.role}) attempted to remove user ${targetUserId} without ADMIN role`);
            return NextResponse.json({ error: 'Only household admins can remove other members' }, { status: 403 });
        }

        // Get the member being removed to check their role (especially if they are an admin)
        // Use the SAME client instance
        const { data: memberToRemove, error: memberCheckError } = await supabase
            .from('HouseholdUser')
            .select('userId, role')
            .eq('userId', targetUserId)
            .eq('householdId', householdId)
            .maybeSingle();

        if (memberCheckError) {
            console.error("Target member check error:", memberCheckError);
            return NextResponse.json({ error: 'Failed to check target member details' }, { status: 500 });
        }

        // If the target user doesn't exist in the household, return 404
        if (!memberToRemove) {
            return NextResponse.json({ error: 'Member to remove not found in this household' }, { status: 404 });
        }

        // Prevent removing the last admin
        // Use the SAME client instance
        if (memberToRemove.role === 'ADMIN') {
            const { count: adminCount, error: countError } = await supabase
                .from('HouseholdUser')
                .select('id', { count: 'exact', head: true })
                .eq('householdId', householdId)
                .eq('role', 'ADMIN');

            if (countError || adminCount === null) {
                console.error("Admin count error:", countError);
                return NextResponse.json({ error: 'Failed to verify admin count' }, { status: 500 });
            }

            if (adminCount <= 1) {
                 console.warn(`Attempt to remove the last admin (User ID: ${targetUserId}) from household ${householdId}`);
                return NextResponse.json({ error: 'Cannot remove the last admin. Assign another admin first or delete the household.' }, { status: 400 });
            }
        }

        // Proceed with removal using the SAME client instance
        const { error: deleteError } = await supabase
            .from('HouseholdUser')
            .delete()
            .eq('userId', targetUserId)
            .eq('householdId', householdId);

        if (deleteError) {
            console.error('Error removing household member:', deleteError);
            return NextResponse.json({ error: 'Failed to remove household member', details: deleteError.message }, { status: 500 });
        }

         console.log(`Successfully removed member ${targetUserId} from household ${householdId} by user ${session.user.id}`);
        return NextResponse.json({
            message: 'Member removed successfully',
            removed: { userId: targetUserId, householdId }
        }, { status: 200 });

    } catch (error) {
        console.error('Error removing household member (outer catch):', error);
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to remove household member', details: message }, { status: 500 });
    }
}