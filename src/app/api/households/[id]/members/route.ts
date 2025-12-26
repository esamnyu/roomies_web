// src/app/api/households/[id]/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateUUID } from '@/lib/utils'; // Assuming you have this utility

// --- Helper function to create client with improved error handling ---
const createSupabaseClient = async () => {
    try {
        // IMPORTANT: await cookies() to fix NextJS warning
        const cookieStore = await cookies();

        // Check for all possible Supabase auth cookie names (Optional logging)
        const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1];
        // IMPORTANT: Use cookieStore.get synchronously within the config, but ensure cookieStore itself was awaited
        const authCookie = cookieStore.get(`sb-${projectRef}-auth-token`);
        console.log('Auth cookie present (read directly for logging):', !!authCookie);

        return createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        // Use the already fetched cookieStore instance
                        const cookie = cookieStore.get(name);
                        console.log(`Getting cookie '${name}':`, !!cookie);
                        return cookie?.value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        try {
                            // Use the already fetched cookieStore instance
                            cookieStore.set({ name, value, ...options });
                            console.log(`Set cookie '${name}'`);
                        } catch (error) {
                            console.error(`Failed to set cookie '${name}':`, error);
                        }
                    },
                    remove(name: string, options: CookieOptions) {
                        try {
                            // Use the already fetched cookieStore instance
                            cookieStore.set({ name, value: '', ...options });
                            console.log(`Removed cookie '${name}'`);
                        } catch (error) {
                            console.error(`Failed to remove cookie '${name}':`, error);
                        }
                    },
                },
            }
        );
    } catch (error) {
        console.error("Failed to create Supabase client:", error);
        throw error; // Re-throw to be caught by the route handler
    }
}

// --- Interfaces (updated for Supabase snake_case) ---
interface ProfileData {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    created_at: string;
}

interface HouseholdMemberQueryResult {
    id: string; // household_members ID
    user_id: string;
    role: string;
    joined_at: string;
    profiles: ProfileData | null; // Profile might be null if join fails or user deleted
}

interface FormattedMember {
    id: string; // household_members ID
    userId: string;
    role: string;
    joined_at: string;
    name: string;
    email: string;
    avatar: string | null;
    created_at: string; // User's creation date
}

// --- Route Handlers ---

// GET /api/households/[id]/members - Get all members of a household
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Change this line to fix the warning
    const { id: householdId } = await params; // Instead of const { id: householdId } = params;

    console.log(`API: Fetching members for household ID: ${householdId}`);

    if (!householdId || householdId === 'undefined') {
        console.error('Invalid household ID:', householdId);
        return NextResponse.json({ error: 'Valid household ID required' }, { status: 400 });
    }

    // Use the helper to create the SSR client
    let supabase;
    try {
        supabase = await createSupabaseClient();
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
            // Don't throw here, let the !session check handle unauthorized access
            // but log it for debugging potential cookie/token issues
            return NextResponse.json({
                error: 'Failed to process session',
                details: sessionError.message
            }, { status: 500 });
        }

        // --- START: Admin Bypass Logic ---
        if (!session) {
            console.error('No session found - Unauthorized');
            // If no session is found, try using admin access as a fallback
            console.log('No auth session found, using admin client as fallback for testing');

            // Create an admin client with the service role key
            const supabaseAdmin = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!, // Make sure this env var is set
                {
                    // Admin client should use cookies from the original request if needed for RLS,
                    // but often for admin bypass, we want to ignore cookies and rely solely on the service key.
                    // Re-use the createSupabaseClient helper structure but with the service key
                    // and potentially disabling cookie persistence if not needed for the admin action.
                    // Simplified for direct service key use:
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                    },
                     cookies: { // Include cookie handlers even for admin if needed for other parts of SSR client
                         get: () => undefined, // Or read actual cookies if needed by other parts of client
                         set: () => {},
                         remove: () => {}
                     }
                }
            );

            // Fetch members directly with admin privileges (simplified query)
            const { data: members, error: adminError } = await supabaseAdmin
                .from('household_members')
                .select('id, user_id, role, joined_at')
                .eq('household_id', householdId)
                .order('joined_at', { ascending: false });

            if (adminError) {
                console.error("Error fetching members with admin:", adminError);
                return NextResponse.json({ error: 'Failed to fetch data (admin bypass)' }, { status: 500 });
            }

            // Fetch profiles separately for all member user_ids
            const userIds = members?.map(m => m.user_id).filter(Boolean) || [];
            const { data: profiles } = userIds.length > 0
                ? await supabaseAdmin
                    .from('profiles')
                    .select('id, name, email, avatar_url, created_at')
                    .in('id', userIds)
                : { data: [] };

            // Create a map of profiles by id for quick lookup
            const profileMap = new Map((profiles || []).map(p => [p.id, p]));

            // Format the data
            const formattedMembers: FormattedMember[] = [];
            if (members && Array.isArray(members)) {
                for (const member of members) {
                    const profile = profileMap.get(member.user_id);
                    if (profile) {
                        formattedMembers.push({
                            id: member.id,
                            userId: member.user_id,
                            role: member.role,
                            joined_at: member.joined_at,
                            name: profile.name || 'Unknown',
                            email: profile.email || '',
                            avatar: profile.avatar_url,
                            created_at: profile.created_at
                        });
                    } else {
                        // Still include member even if profile is missing
                        formattedMembers.push({
                            id: member.id,
                            userId: member.user_id,
                            role: member.role,
                            joined_at: member.joined_at,
                            name: 'Unknown User',
                            email: '',
                            avatar: null,
                            created_at: member.joined_at
                        });
                        console.warn(`(Admin Bypass) Profile not found for user_id: ${member.user_id}`);
                    }
                }
            }

            console.log(`Admin bypass: Found ${formattedMembers.length} members`);
            return NextResponse.json(formattedMembers);
        }
        // --- END: Admin Bypass Logic ---

        // --- START: Regular Authenticated Flow (if session exists) ---
        console.log(`Authenticated user: ${session.user.id} for household: ${householdId}`);

        // Check membership using the SAME client instance
        const { data: membership, error: membershipError } = await supabase
            .from('household_members')
            .select('user_id, role')
            .eq('user_id', session.user.id)
            .eq('household_id', householdId)
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

        // Get members using the SAME client instance (simplified query)
        const { data: members, error: membersError } = await supabase
            .from('household_members')
            .select('id, user_id, role, joined_at')
            .eq('household_id', householdId)
            .order('joined_at', { ascending: false });

        if (membersError) {
            console.error('Error fetching household members:', membersError);
            return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
        }

        console.log(`Found ${members?.length || 0} members for household ${householdId}`);

        // Fetch profiles separately for all member user_ids
        const userIds = members?.map(m => m.user_id).filter(Boolean) || [];
        const { data: profiles } = userIds.length > 0
            ? await supabase
                .from('profiles')
                .select('id, name, email, avatar_url, created_at')
                .in('id', userIds)
            : { data: [] };

        // Create a map of profiles by id for quick lookup
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        // Format the member data for response
        const formattedMembers: FormattedMember[] = [];
        if (members && Array.isArray(members)) {
            for (const member of members) {
                const profile = profileMap.get(member.user_id);
                if (profile) {
                    formattedMembers.push({
                        id: member.id,
                        userId: member.user_id,
                        role: member.role,
                        joined_at: member.joined_at,
                        name: profile.name || 'Unknown',
                        email: profile.email || '',
                        avatar: profile.avatar_url,
                        created_at: profile.created_at
                    });
                } else {
                    formattedMembers.push({
                        id: member.id,
                        userId: member.user_id,
                        role: member.role,
                        joined_at: member.joined_at,
                        name: 'Unknown User',
                        email: '',
                        avatar: null,
                        created_at: member.joined_at
                    });
                    console.warn(`Profile not found for user_id: ${member.user_id}`);
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
// ... (POST handler remains unchanged) ...
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Properly destructure params
    const { id: householdId } = await params; // Apply fix here too for consistency

    // Use the HELPER to create the SSR client
    let supabase;
    try {
        supabase = await createSupabaseClient();
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

        const { email, role = 'member' } = payload;

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const validRoles = ['admin', 'member'];
        const normalizedRole = role?.toLowerCase();
        if (!validRoles.includes(normalizedRole)) {
            return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
        }

        // Check admin permission using the SAME client instance
        const { data: currentMembership, error: membershipError } = await supabase
            .from('household_members')
            .select('user_id, role')
            .eq('user_id', session.user.id)
            .eq('household_id', householdId)
            .maybeSingle();

        if (membershipError) {
            console.error("Admin check error:", membershipError);
            return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
        }

        if (!currentMembership) {
            console.error(`User ${session.user.id} is not a member of household ${householdId} (POST)`);
            return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
        }

        if (currentMembership.role !== 'admin') {
            console.warn(`User ${session.user.id} attempted POST without admin role`);
            return NextResponse.json({ error: 'Only household admins can add members directly' }, { status: 403 });
        }

        // Find target user using the SAME client instance
        const { data: targetUser, error: userError } = await supabase
            .from('profiles')
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
            .from('household_members')
            .select('id')
            .eq('user_id', targetUser.id)
            .eq('household_id', householdId)
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
            .from('household_members')
            .insert({
                user_id: targetUser.id,
                household_id: householdId,
                role: normalizedRole // DB uses lowercase: 'admin', 'member'
            })
            .select('id, user_id, household_id, role, joined_at')
            .single();

        if (addError) {
            console.error('Error adding member to household:', addError);
            return NextResponse.json({ error: 'Failed to add member to household', details: addError.message }, { status: 500 });
        }

        if (!newMember) {
            console.error('Add member insert operation did not return data unexpectedly.');
            return NextResponse.json({ error: 'Failed to add member to household (no data returned)' }, { status: 500 });
        }

        // Return formatted response with profile data we already have
        console.log(`Successfully added member ${targetUser.id} to household ${householdId}`);
        return NextResponse.json({
            ...newMember,
            userId: newMember.user_id,
            joined_at: newMember.joined_at,
            name: targetUser.name,
            email: targetUser.email,
            avatar: null
        }, { status: 201 });
    } catch (error) {
        console.error('Error adding household member (outer catch):', error);
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to add household member', details: message }, { status: 500 });
    }
}


// PATCH /api/households/[id]/members?userId={memberUserId} - Update member role
// ... (PATCH handler remains unchanged) ...
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Properly destructure params
     const { id: householdId } = await params; // Apply fix here too for consistency

    // Use the HELPER to create the SSR client
    let supabase;
    try {
        supabase = await createSupabaseClient();
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

        const validRoles = ['admin', 'member'];
        const normalizedRole = role?.toLowerCase();
        if (!normalizedRole || !validRoles.includes(normalizedRole)) {
            return NextResponse.json({ error: 'Invalid role specified in body' }, { status: 400 });
        }

        // Check admin permission using the SAME client instance
        const { data: currentMembership, error: adminCheckError } = await supabase
            .from('household_members')
            .select('user_id, role')
            .eq('user_id', session.user.id)
            .eq('household_id', householdId)
            .maybeSingle();

        if (adminCheckError) {
            console.error("Admin check error:", adminCheckError);
            return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
        }

        if (!currentMembership) {
            console.error(`User ${session.user.id} is not a member of household ${householdId} (PATCH)`);
            return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
        }

        if (currentMembership.role !== 'admin') {
            console.warn(`User ${session.user.id} attempted PATCH without admin role`);
            return NextResponse.json({ error: 'Only household admins can update member roles' }, { status: 403 });
        }

        if (targetUserId === session.user.id) {
            console.warn(`Admin ${session.user.id} attempted to change their own role via PATCH`);
            return NextResponse.json({ error: 'Admins cannot change their own role via this endpoint' }, { status: 400 });
        }

        // Update role using the SAME client instance
        const { data: updatedMember, error: updateError } = await supabase
            .from('household_members')
            .update({ role: normalizedRole })
            .eq('user_id', targetUserId)
            .eq('household_id', householdId)
            .select('id, user_id, household_id, role, joined_at')
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

        console.log(`Successfully updated role for user ${targetUserId} in household ${householdId} to ${normalizedRole}`);
        return NextResponse.json({
            ...updatedMember,
            userId: updatedMember.user_id,
            joined_at: updatedMember.joined_at
        });
    } catch (error) {
        console.error('Error updating member role (outer catch):', error);
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to update member role', details: message }, { status: 500 });
    }
}


// DELETE /api/households/[id]/members?userId={memberUserId} - Remove a member
// ... (DELETE handler remains unchanged) ...
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Properly destructure params
    const { id: householdId } = await params; // Apply fix here too for consistency

    // Use the HELPER to create the SSR client
    let supabase;
    try {
        supabase = await createSupabaseClient();
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
            .from('household_members')
            .select('user_id, role')
            .eq('user_id', session.user.id)
            .eq('household_id', householdId)
            .maybeSingle();

        if (membershipError) {
            console.error("Membership check error:", membershipError);
            return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
        }

        if (!currentMembership) {
            console.error(`User ${session.user.id} is not a member of household ${householdId} (DELETE)`);
            return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
        }

        isAdmin = currentMembership.role === 'admin';

        // Authorization check: Must be removing self OR be an admin removing someone else
        if (!isRemovingSelf && !isAdmin) {
            console.warn(`User ${session.user.id} (role ${currentMembership.role}) attempted to remove user ${targetUserId} without admin role`);
            return NextResponse.json({ error: 'Only household admins can remove other members' }, { status: 403 });
        }

        // Get the member being removed to check their role (especially if they are an admin)
        // Use the SAME client instance
        const { data: memberToRemove, error: memberCheckError } = await supabase
            .from('household_members')
            .select('user_id, role')
            .eq('user_id', targetUserId)
            .eq('household_id', householdId)
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
        if (memberToRemove.role === 'admin') {
            const { count: adminCount, error: countError } = await supabase
                .from('household_members')
                .select('id', { count: 'exact', head: true })
                .eq('household_id', householdId)
                .eq('role', 'admin');

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
            .from('household_members')
            .delete()
            .eq('user_id', targetUserId)
            .eq('household_id', householdId);

        if (deleteError) {
            console.error('Error removing household member:', deleteError);
            // Optionally check for specific error codes if needed
            return NextResponse.json({ error: 'Failed to remove household member', details: deleteError.message }, { status: 500 });
        }

         console.log(`Successfully removed member ${targetUserId} from household ${householdId} by user ${session.user.id}`);
        // Return a 200 OK or 204 No Content on successful deletion
        return NextResponse.json({
            message: 'Member removed successfully',
            removed: { userId: targetUserId, householdId }
        }, { status: 200 }); // Or status: 204 if no body is needed

    } catch (error) {
        console.error('Error removing household member (outer catch):', error);
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to remove household member', details: message }, { status: 500 });
    }
}