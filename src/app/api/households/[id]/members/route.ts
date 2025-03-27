// src/app/api/households/[id]/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
// REMOVE this - we will use the client created by the helper
// import { supabase } from '@/lib/supabase';
// CORRECT import from ssr
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateUUID } from '@/lib/utils'; // Assuming you have this utility

// --- Helper function to create client ---
// Placed here for self-containment, or import from a shared lib
const createSupabaseClient = async () => {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return cookieStore.get(name)?.value },
                set(name: string, value: string, options: CookieOptions) {
                   try { cookieStore.set({ name, value, ...options }); } catch (error) { console.error(`Failed to set cookie '${name}':`, error); }
                 },
                remove(name: string, options: CookieOptions) {
                   try { cookieStore.set({ name, value: '', ...options }); } catch (error) { console.error(`Failed to remove cookie '${name}':`, error); }
                 },
            },
        }
    );
}

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
    // Use the HELPER to create the SSR client
    const supabase = await createSupabaseClient();
    try {
      // Get session using the SAME client instance
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const householdId = params.id;
      if (!householdId) return NextResponse.json({ error: 'Household ID required' }, { status: 400 });

      // Check membership using the SAME client instance
      const { data: membership, error: membershipError } = await supabase
        .from('HouseholdUser')
        .select('userId, role')
        .eq('userId', session.user.id)
        .eq('householdId', householdId)
        .maybeSingle();

      if (membershipError) { console.error("Membership check error:", membershipError); return NextResponse.json({ error: 'Failed to verify membership' }, { status: 500 }); }
      if (!membership) { return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 }); }

      // Get members using the SAME client instance
      const { data, error: membersError } = await supabase
        .from('HouseholdUser')
        .select(`
          id, userId, role, joinedAt,
          user:User!userId( id, name, email, avatar, createdAt )
        `)
        .eq('householdId', householdId)
        .order('joinedAt', { ascending: false });

      if (membersError) { console.error('Error fetching household members:', membersError); return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 }); }

      // Format the member data for response
      const formattedMembers: FormattedMember[] = [];
      if (data && Array.isArray(data)) {
        const queryResults = data as unknown as HouseholdMemberQueryResult[];
        for (const member of queryResults) {
          if (member && member.user && member.user.id && member.user.name && member.user.email) {
            const userData = member.user;
            formattedMembers.push({
              id: member.id, userId: member.userId, role: member.role, joinedAt: member.joinedAt,
              name: userData.name, email: userData.email, avatar: userData.avatar, createdAt: userData.createdAt
            });
          } else { console.warn(`Skipping member formatting due to missing data for HouseholdUser ID: ${member?.id}, User ID: ${member?.userId}`); }
        }
      }
      return NextResponse.json(formattedMembers);
    } catch (error) {
      console.error('Error fetching household members:', error);
      const message = error instanceof Error ? error.message : 'Unknown server error';
      return NextResponse.json({ error: 'Failed to fetch household members', details: message }, { status: 500 });
    }
}

// POST /api/households/[id]/members - Add a member to the household (Manual Add)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Use the HELPER to create the SSR client
  const supabase = await createSupabaseClient();
  try {
    // Get session using the SAME client instance
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

    const householdId = params.id;
    if (!householdId) return NextResponse.json({ error: 'Household ID required' }, { status: 400 });

    let payload;
    try { payload = await request.json(); } catch(e) { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
    const { email, role = 'MEMBER' } = payload;

    if (!email) { return NextResponse.json({ error: 'Email is required' }, { status: 400 }); }
    const validRoles = ['ADMIN', 'MEMBER', 'GUEST'];
    if (!validRoles.includes(role)) { return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 }); }

    // Check admin permission using the SAME client instance
    const { data: currentMembership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', session.user.id)
      .eq('householdId', householdId)
      .maybeSingle();

    if (membershipError) { console.error("Admin check error:", membershipError); return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 }); }
    if (!currentMembership) { return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 }); }
    if (currentMembership.role !== 'ADMIN') { return NextResponse.json({ error: 'Only household admins can add members directly' }, { status: 403 }); }

    // Find target user using the SAME client instance
    const { data: targetUser, error: userError } = await supabase
      .from('User')
      .select('id, name, email')
      .eq('email', email)
      .maybeSingle();

    if (userError) { console.error("Target user lookup error:", userError); return NextResponse.json({ error: 'Failed to find user by email' }, { status: 500 }); }
    if (!targetUser) { return NextResponse.json({ error: 'User with specified email not found' }, { status: 404 }); }

    // Check existing membership using the SAME client instance
    const { data: existingMember, error: existingError } = await supabase
      .from('HouseholdUser')
      .select('id')
      .eq('userId', targetUser.id)
      .eq('householdId', householdId)
      .limit(1)
      .maybeSingle();

    if (existingError) { console.error("Existing member check error:", existingError); return NextResponse.json({ error: 'Failed to check existing membership' }, { status: 500 }); }
    if (existingMember) { return NextResponse.json({ error: 'User is already a member of this household' }, { status: 409 }); }

    // Add member using the SAME client instance
    const newMembershipId = generateUUID();
    const { data: newMember, error: addError } = await supabase
      .from('HouseholdUser')
      .insert({
        // id: newMembershipId, // Only if needed
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

    if (addError) { console.error('Error adding member to household:', addError); return NextResponse.json({ error: 'Failed to add member to household', details: addError.message }, { status: 500 }); }
    if (!newMember) { console.error('Add member insert operation did not return data.'); return NextResponse.json({ error: 'Failed to add member to household' }, { status: 500 }); }

    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    console.error('Error adding household member:', error);
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: 'Failed to add household member', details: message }, { status: 500 });
  }
}

// NOTE: PATCH and DELETE handlers for specific members are kept here for file completion,
// but ideally belong in a separate route like /api/households/[id]/members/[userId]

// PATCH /api/households/[id]/members?userId={memberUserId} - Update member role
export async function PATCH( request: NextRequest, { params }: { params: { id: string } } ) {
    // Use the HELPER to create the SSR client
    const supabase = await createSupabaseClient();
    try {
        // Get session using the SAME client instance
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const householdId = params.id;
        if (!householdId) return NextResponse.json({ error: 'Household ID required in path' }, { status: 400 });

        const { searchParams } = new URL(request.url);
        const targetUserId = searchParams.get('userId');
        if (!targetUserId) return NextResponse.json({ error: 'Target userId required as query parameter' }, { status: 400 });

        let payload;
        try { payload = await request.json(); } catch(e) { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
        const { role } = payload;

        const validRoles = ['ADMIN', 'MEMBER', 'GUEST'];
        if (!role || !validRoles.includes(role)) return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });

        // Check admin permission using the SAME client instance
        const { data: currentMembership, error: adminCheckError } = await supabase
          .from('HouseholdUser')
          .select('userId, role')
          .eq('userId', session.user.id)
          .eq('householdId', householdId)
          .maybeSingle();

        if (adminCheckError) { console.error("Admin check error:", adminCheckError); return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 }); }
        if (!currentMembership) return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
        if (currentMembership.role !== 'ADMIN') return NextResponse.json({ error: 'Only household admins can update member roles' }, { status: 403 });

        if (targetUserId === session.user.id) { return NextResponse.json({ error: 'Admins cannot change their own role via this endpoint' }, { status: 400 }); }

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

        if (updateError) { console.error('Error updating member role:', updateError); if (updateError.code === 'PGRST116') return NextResponse.json({ error: 'Target member not found in this household' }, { status: 404 }); return NextResponse.json({ error: 'Failed to update member role', details: updateError.message }, { status: 500 }); }
        if (!updatedMember) { console.error('Update member role did not return data.'); return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 }); }

        return NextResponse.json(updatedMember);
      } catch (error) {
        console.error('Error updating member role:', error);
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to update member role', details: message }, { status: 500 });
      }
}


// DELETE /api/households/[id]/members?userId={memberUserId} - Remove a member
export async function DELETE( request: NextRequest, { params }: { params: { id: string } } ) {
    // Use the HELPER to create the SSR client
    const supabase = await createSupabaseClient();
    try {
        // Get session using the SAME client instance
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const householdId = params.id;
        if (!householdId) return NextResponse.json({ error: 'Household ID required in path' }, { status: 400 });

        const { searchParams } = new URL(request.url);
        const targetUserId = searchParams.get('userId');
        if (!targetUserId) return NextResponse.json({ error: 'Target userId required as query parameter' }, { status: 400 });

        const isRemovingSelf = targetUserId === session.user.id;
        let isAdmin = false;

        // Check current user's membership using the SAME client instance
        const { data: currentMembership, error: membershipError } = await supabase
          .from('HouseholdUser')
          .select('userId, role')
          .eq('userId', session.user.id)
          .eq('householdId', householdId)
          .maybeSingle();

        if (membershipError) { console.error("Membership check error:", membershipError); return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 }); }
        if (!currentMembership) return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
        isAdmin = currentMembership.role === 'ADMIN';

        if (!isRemovingSelf && !isAdmin) { return NextResponse.json({ error: 'Only household admins can remove other members' }, { status: 403 }); }

        // Get member being removed using the SAME client instance
        const { data: memberToRemove, error: memberCheckError } = await supabase
          .from('HouseholdUser')
          .select('userId, role')
          .eq('userId', targetUserId)
          .eq('householdId', householdId)
          .maybeSingle();

        if (memberCheckError) { console.error("Target member check error:", memberCheckError); return NextResponse.json({ error: 'Failed to check target member' }, { status: 500 }); }
        if (!memberToRemove) return NextResponse.json({ error: 'Member to remove not found in this household' }, { status: 404 });

        // Check last admin using the SAME client instance
        if (memberToRemove.role === 'ADMIN') {
          const { count: adminCount, error: countError } = await supabase
            .from('HouseholdUser')
            .select('id', { count: 'exact', head: true })
            .eq('householdId', householdId)
            .eq('role', 'ADMIN');

          if (countError || adminCount === null) { console.error("Admin count error:", countError); return NextResponse.json({ error: 'Failed to verify admin count' }, { status: 500 }); }
          if (adminCount <= 1) { return NextResponse.json({ error: 'Cannot remove the last admin. Assign another admin first or delete the household.' }, { status: 400 }); }
        }

        // Remove member using the SAME client instance
        const { error: deleteError } = await supabase
          .from('HouseholdUser')
          .delete()
          .eq('userId', targetUserId)
          .eq('householdId', householdId);

        if (deleteError) { console.error('Error removing household member:', deleteError); return NextResponse.json({ error: 'Failed to remove household member', details: deleteError.message }, { status: 500 }); }

        return NextResponse.json({
          message: 'Member removed successfully',
          removed: { userId: targetUserId, householdId }
        });

      } catch (error) {
        console.error('Error removing household member:', error);
        const message = error instanceof Error ? error.message : 'Unknown server error';
        return NextResponse.json({ error: 'Failed to remove household member', details: message }, { status: 500 });
      }
}