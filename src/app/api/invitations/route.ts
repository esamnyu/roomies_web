// src/app/api/invitations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  getInvitationByToken,
  checkInvitationExpiration,
  validateInvitationData,
  createInvitation,
  updateInvitationStatus,
  acceptInvitationByToken,
  addUserToHousehold
} from '@/lib/services/invitationService';

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

// GET /api/invitations - Get all invitations for the current user or for a household
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('household_id');
    const status = searchParams.get('status') || 'pending';
    const tokenParam = searchParams.get('token');

    // Token-based lookup
    if (tokenParam) {
      try {
        const invitation = await getInvitationByToken(supabase, tokenParam);
        await checkInvitationExpiration(supabase, invitation);

        return NextResponse.json({
          id: invitation.id,
          email: invitation.email,
          household_id: invitation.household_id,
          role: invitation.role,
          status: invitation.status,
          expires_at: invitation.expires_at,
          message: invitation.message,
          created_at: invitation.created_at,
          household: invitation.household,
          inviter: invitation.inviter
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch invitation';
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    // Build the base query
    let query = supabase
      .from('invitations')
      .select(`
        *,
        household:households!household_id(id, name, address),
        inviter:profiles!invited_by(id, name, email, avatar_url)
      `);

    if (householdId) {
      // Get invitations for a specific household - requires admin permission
      const { data: householdRole, error: roleError } = await supabase
        .from('household_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('household_id', householdId)
        .single();

      if (roleError || (householdRole?.role !== 'admin')) {
        return NextResponse.json({
          error: 'You must be a household admin to view these invitations'
        }, { status: 403 });
      }

      query = query
        .eq('household_id', householdId)
        .eq('status', status);
    } else {
      // Get invitations for the current user
      query = query
        .eq('email', user.email || '')
        .eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching invitations:', error);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/invitations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/invitations - Create a new invitation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invitationData = await request.json();

    // Validate the data
    validateInvitationData(invitationData);

    // Get user profile from profiles table
    const { data: userData, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', user.id)
      .single();

    if (profileError || !userData) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check if the user is a member and admin of the household
    const { data: currentMembership, error: membershipError } = await supabase
      .from('household_members')
      .select('user_id, role')
      .eq('user_id', userData.id)
      .eq('household_id', invitationData.householdId || invitationData.household_id)
      .single();

    if (membershipError || !currentMembership) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }

    if (currentMembership.role !== 'admin') {
      return NextResponse.json({ error: 'Only household admins can invite members' }, { status: 403 });
    }

    // Create the invitation
    const result = await createInvitation(
      supabase,
      invitationData,
      userData.id,
      userData.name || user.email || 'User',
      request
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/invitations:', error);
    const message = error instanceof Error ? error.message : 'Failed to create invitation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/invitations - Update an invitation status (accept or decline)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract invitation ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const invitationId = pathParts[pathParts.length - 1];

    if (!invitationId || pathParts[pathParts.length - 2] !== 'invitations') {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const requestData = await request.json();
    const { status } = requestData;

    if (!status || !['accepted', 'declined'].includes(status.toLowerCase())) {
      return NextResponse.json({
        error: 'Invalid status value. Must be accepted or declined'
      }, { status: 400 });
    }

    const normalizedStatus = status.toLowerCase() as 'accepted' | 'declined';

    // Update the invitation
    const updatedInvitation = await updateInvitationStatus(
      supabase,
      invitationId,
      normalizedStatus,
      user.email || ''
    );

    // If accepted, add the user to the household
    if (normalizedStatus === 'accepted') {
      await addUserToHousehold(
        supabase,
        user.id,
        updatedInvitation.household_id,
        updatedInvitation.role || 'member'
      );

      return NextResponse.json({
        message: 'Invitation accepted successfully',
        invitation: updatedInvitation,
        redirectTo: `/dashboard/${updatedInvitation.household_id}`
      });
    }

    return NextResponse.json({
      message: `Invitation ${normalizedStatus} successfully`,
      invitation: updatedInvitation
    });
  } catch (error) {
    console.error('Error in PATCH /api/invitations:', error);
    const message = error instanceof Error ? error.message : 'Failed to update invitation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT endpoint to accept an invitation with token
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tokenParam = searchParams.get('token');

    if (!tokenParam) {
      return NextResponse.json({ error: 'Missing invitation token' }, { status: 400 });
    }

    // Check if the user wants to claim with a different email
    let claimWithCurrentEmail = false;
    try {
      const requestBody = await request.json();
      claimWithCurrentEmail = !!requestBody.claimWithCurrentEmail;
    } catch {
      // No body or invalid JSON
    }

    // Accept the invitation
    const result = await acceptInvitationByToken(
      supabase,
      tokenParam,
      user,
      claimWithCurrentEmail
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in PUT /api/invitations:', error);
    const message = error instanceof Error ? error.message : 'Failed to accept invitation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
