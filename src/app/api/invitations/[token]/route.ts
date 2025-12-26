// src/app/api/invitations/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateUUID } from '@/lib/utils';

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

// GET /api/invitations/[token] - Get invitation details by token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = await createSupabaseRouteHandlerClient();

    // Access token parameter
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // Get the invitation by token
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select(`
        id,
        email,
        household_id,
        invited_by,
        role,
        status,
        message,
        expires_at,
        created_at,
        household:households!household_id(id, name, address),
        inviter:profiles!invited_by(id, name, email, avatar_url)
      `)
      .eq('token', token)
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check if the invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Update the invitation status to expired
      await supabase
        .from('invitations')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);

      return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
    }

    // Check if the invitation has already been used
    if (invitation.status !== 'pending') {
      return NextResponse.json({
        error: `This invitation has already been ${invitation.status}`
      }, { status: 400 });
    }

    // Return the invitation details (without the token for security)
    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      message: invitation.message,
      expires_at: invitation.expires_at,
      created_at: invitation.created_at,
      household: invitation.household,
      inviter: invitation.inviter
    });
  } catch (error) {
    console.error('Error fetching invitation:', error);
    return NextResponse.json({ error: 'Failed to fetch invitation' }, { status: 500 });
  }
}

// POST /api/invitations/[token] - Accept or decline an invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Access token parameter
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const { action, claimWithCurrentEmail = false } = await request.json();

    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get the invitation by token
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select(`
        id,
        email,
        household_id,
        role,
        status,
        expires_at
      `)
      .eq('token', token)
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check if the invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Update the invitation status to expired
      await supabase
        .from('invitations')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);

      return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
    }

    // Check if the invitation has already been used
    if (invitation.status !== 'pending') {
      return NextResponse.json({
        error: `This invitation has already been ${invitation.status}`
      }, { status: 400 });
    }

    // Handle the invitation action
    if (action === 'decline') {
      // Update the invitation status to declined
      await supabase
        .from('invitations')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);

      return NextResponse.json({ message: 'Invitation declined successfully' });
    }

    // If accepting the invitation

    // Check if the user is authenticated
    if (!user) {
      // Return a special response indicating the user needs to authenticate
      return NextResponse.json({
        requiresAuth: true,
        email: invitation.email
      }, { status: 401 });
    }

    // Check if the authenticated user's email matches the invitation email
    // or if they explicitly want to claim it with their current email
    if (user.email !== invitation.email && !claimWithCurrentEmail) {
      return NextResponse.json({
        error: 'This invitation was sent to a different email address'
      }, { status: 403 });
    }

    // Check if the user is already a member of the household
    const { data: existingMember, error: memberError } = await supabase
      .from('household_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('household_id', invitation.household_id)
      .maybeSingle();

    if (!memberError && existingMember) {
      // Update the invitation status to accepted
      await supabase
        .from('invitations')
        .update({ status: 'accepted', updated_at: new Date().toISOString(), accepted_at: new Date().toISOString() })
        .eq('id', invitation.id);

      return NextResponse.json({
        message: 'You are already a member of this household',
        redirectTo: '/dashboard'
      });
    }

    // If accepting with a different email, add a note to the invitation record
    if (claimWithCurrentEmail && user.email !== invitation.email) {
      await supabase
        .from('invitations')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString(),
          accepted_at: new Date().toISOString(),
          notes: `Claimed by ${user.email} (original recipient: ${invitation.email})`
        })
        .eq('id', invitation.id);
    } else {
      await supabase
        .from('invitations')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString(),
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.id);
    }

    // Add the user to the household
    const membershipId = generateUUID();
    const { error: joinError } = await supabase
      .from('household_members')
      .insert([
        {
          id: membershipId,
          user_id: user.id,
          household_id: invitation.household_id,
          role: invitation.role || 'member',
          joined_at: new Date().toISOString()
        }
      ]);

    if (joinError) {
      console.error('Error adding user to household:', joinError);
      return NextResponse.json({ error: 'Failed to join household' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Successfully joined the household',
      redirectTo: '/dashboard'
    });
  } catch (error) {
    console.error('Error processing invitation:', error);
    return NextResponse.json({ error: 'Failed to process invitation' }, { status: 500 });
  }
}
