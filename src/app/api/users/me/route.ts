// src/app/api/users/me/route.ts
import { NextResponse } from 'next/server';
import { withAuth, errorResponse } from '@/lib/supabase-server';
// Import the admin client for Supabase Auth user deletion
import { supabase as supabaseAdmin } from '@/lib/supabase';

// GET /api/users/me - Get current user's details
export const GET = withAuth(async (_request, user, supabase) => {
  const userId = user.id;

  // 1. Get the user's core details from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, created_at')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('Error fetching user profile:', profileError);
    if (profileError.code === 'PGRST116') {
      return errorResponse('User profile not found', 404);
    }
    return errorResponse('Failed to fetch user profile');
  }

  if (!profile) {
    return errorResponse('User profile not found', 404);
  }

  // 2. Get household memberships with household details
  const { data: memberships, error: membershipsError } = await supabase
    .from('household_members')
    .select(`
      role,
      joined_at,
      household:households!household_id(id, name, address, created_at)
    `)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });

  if (membershipsError) {
    console.error('Error fetching user households:', membershipsError);
  }

  // 3. Get counts
  const { count: expenseCreatedCount } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', userId);

  const { count: expenseSplitCount } = await supabase
    .from('expense_splits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  // Format user data for response
  const userData = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    avatar: profile.avatar_url,
    created_at: profile.created_at,
    statistics: {
      expensesCreated: expenseCreatedCount ?? 0,
      expenseSplits: expenseSplitCount ?? 0,
    },
    households: (memberships || []).map((m: { role: string; joined_at: string; household: unknown }) => {
      const household = Array.isArray(m.household) ? m.household[0] : m.household;
      const h = household as { id?: string; name?: string; address?: string; created_at?: string } | null;
      return {
        id: h?.id,
        name: h?.name,
        address: h?.address,
        created_at: h?.created_at,
        joined_at: m.joined_at,
        role: m.role,
      };
    }).filter((h: { id?: string }) => h.id),
  };

  return NextResponse.json(userData);
});

// DELETE /api/users/me - Delete current user's account (MVP Version)
export const DELETE = withAuth(async (_request, user, supabase) => {
  // **************************************************************************
  // ** WARNING: MVP IMPLEMENTATION - LACKS TRANSACTIONAL SAFETY & FULL CLEANUP **
  // ** Related data (Expenses, Tasks etc.) WILL BE ORPHANED.              **
  // ** Use a Supabase Database Function for production account deletion.   **
  // **************************************************************************

  const userId = user.id;
  console.warn(`Executing MVP DELETE for user ${userId}. Data orphaning will occur.`);

  // --- Sole Admin Check ---
  const { data: adminMemberships, error: adminCheckError } = await supabase
    .from('household_members')
    .select(`
      household_id,
      household:households!household_id(id, name)
    `)
    .eq('user_id', userId)
    .eq('role', 'admin');

  if (adminCheckError) {
    console.error('Error fetching admin memberships:', adminCheckError);
    return errorResponse('Failed to check admin status.');
  }

  if (adminMemberships && adminMemberships.length > 0) {
    const problematicHouseholds: string[] = [];

    for (const membership of adminMemberships) {
      const householdData = Array.isArray(membership.household) ? membership.household[0] : membership.household;
      if (!householdData) continue;

      const householdId = membership.household_id;
      const householdName = (householdData as { name?: string }).name;

      // Count total members in this household
      const { count: totalMemberCount, error: totalCountErr } = await supabase
        .from('household_members')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId);

      if (totalCountErr || totalMemberCount === null) {
        return errorResponse(`Failed to check member count for household ${householdName}.`);
      }

      // If household has more than one member
      if (totalMemberCount > 1) {
        const { count: otherAdminCount, error: otherAdminErr } = await supabase
          .from('household_members')
          .select('*', { count: 'exact', head: true })
          .eq('household_id', householdId)
          .eq('role', 'admin')
          .neq('user_id', userId);

        if (otherAdminErr || otherAdminCount === null) {
          return errorResponse(`Failed to check other admins for household ${householdName}.`);
        }

        if (otherAdminCount === 0) {
          problematicHouseholds.push(householdName || householdId);
        }
      }
    }

    if (problematicHouseholds.length > 0) {
      return NextResponse.json({
        error: 'You are the only admin of one or more households with other members. Please transfer admin rights or remove other members first.',
        households: problematicHouseholds,
      }, { status: 400 });
    }
  }

  // --- MVP Deletion Steps ---

  // 1. Delete household_members memberships
  const { error: deleteMembershipsError } = await supabase
    .from('household_members')
    .delete()
    .eq('user_id', userId);

  if (deleteMembershipsError) {
    console.error('Error deleting user memberships:', deleteMembershipsError);
  }

  // 2. Delete the user from the 'profiles' table
  const { error: deleteProfileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (deleteProfileError) {
    console.error('Error deleting user from profiles table:', deleteProfileError);
    return errorResponse('Failed to delete user profile data.');
  }

  // 3. Delete the user from Supabase Auth (Requires Admin Client)
  if (!supabaseAdmin || typeof supabaseAdmin.auth?.admin?.deleteUser !== 'function') {
    console.error('CRITICAL: Supabase Admin Client not configured.');
    return errorResponse('User data deleted, but Admin client not configured to delete authentication record.');
  }

  const { error: deleteAuthUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteAuthUserError) {
    console.error('CRITICAL: Error deleting user from Supabase Auth:', deleteAuthUserError);
    return errorResponse('User data deleted, but failed to delete authentication record.');
  }

  return NextResponse.json({
    message: 'Account deletion process initiated successfully.'
  });
});
