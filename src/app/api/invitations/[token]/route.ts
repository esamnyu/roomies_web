// src/app/api/invitations/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
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
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch (error) { console.error("Error setting cookie:", name, error); }
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) { console.error("Error removing cookie:", name, error); }
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
    // Access token parameter - params is now awaited by Next.js internally
    const { token } = await params;
    
    if (!token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }
    
    // Get the invitation by token
    const { data: invitation, error: invitationError } = await supabaseClient
      .from('invitations')
      .select(`
        id,
        email,
        householdId,
        inviterId,
        role,
        status,
        message,
        expiresAt,
        createdAt,
        household:householdId(id, name, address),
        inviter:inviterId(id, name, email, avatar)
      `)
      .eq('token', token)
      .single();
    
    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    
    // Check if the invitation has expired
    if (new Date(invitation.expiresAt) < new Date()) {
      // Update the invitation status to EXPIRED
      await supabaseClient
        .from('invitations')
        .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);
      
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
    }
    
    // Check if the invitation has already been used
    if (invitation.status !== 'PENDING') {
      return NextResponse.json({ 
        error: `This invitation has already been ${invitation.status.toLowerCase()}` 
      }, { status: 400 });
    }
    
    // Return the invitation details (without the token for security)
    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      message: invitation.message,
      expires_at: invitation.expiresAt,
      created_at: invitation.createdAt,
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
    // Get auth session if the user is logged in
    const supabaseAuth = await createSupabaseRouteHandlerClient();
    const { data: { session } } = await supabaseAuth.auth.getSession();
    
    // Access token parameter - already awaited by Next.js internally
    const { token } = await params;
    
    if (!token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }
    
    const { action, claimWithCurrentEmail = false } = await request.json();
    
    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    // Get the invitation by token
    const { data: invitation, error: invitationError } = await supabaseClient
      .from('invitations')
      .select(`
        id,
        email,
        householdId,
        role,
        status,
        expiresAt
      `)
      .eq('token', token)
      .single();
    
    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    
    // Check if the invitation has expired
    if (new Date(invitation.expiresAt) < new Date()) {
      // Update the invitation status to EXPIRED
      await supabaseClient
        .from('invitations')
        .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);
      
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
    }
    
    // Check if the invitation has already been used
    if (invitation.status !== 'PENDING') {
      return NextResponse.json({ 
        error: `This invitation has already been ${invitation.status.toLowerCase()}` 
      }, { status: 400 });
    }
    
    // Handle the invitation action
    if (action === 'decline') {
      // Update the invitation status to DECLINED
      await supabaseClient
        .from('invitations')
        .update({ status: 'DECLINED', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);
      
      return NextResponse.json({ message: 'Invitation declined successfully' });
    }
    
    // If accepting the invitation
    
    // Check if the user is authenticated
    if (!session) {
      // Return a special response indicating the user needs to authenticate
      return NextResponse.json({ 
        requiresAuth: true,
        email: invitation.email 
      }, { status: 401 });
    }
    
    // Check if the authenticated user's email matches the invitation email
    // or if they explicitly want to claim it with their current email
    if (session.user.email !== invitation.email && !claimWithCurrentEmail) {
      return NextResponse.json({ 
        error: 'This invitation was sent to a different email address' 
      }, { status: 403 });
    }
    
    // Check if the user is already a member of the household
    const { data: existingMember, error: memberError } = await supabaseClient
      .from('household_members')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('household_id', invitation.householdId)
      .single();
    
    if (!memberError && existingMember) {
      // Update the invitation status to ACCEPTED
      await supabaseClient
        .from('invitations')
        .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);
      
      return NextResponse.json({ 
        message: 'You are already a member of this household',
        redirectTo: '/dashboard'
      });
    }
    
    // If accepting with a different email, add a note to the invitation record
    if (claimWithCurrentEmail && session.user.email !== invitation.email) {
      await supabaseClient
        .from('invitations')
        .update({ 
          status: 'ACCEPTED', 
          updated_at: new Date().toISOString(),
          responded_at: new Date().toISOString(),
          notes: `Claimed by ${session.user.email} (original recipient: ${invitation.email})`
        })
        .eq('id', invitation.id);
    } else {
      await supabaseClient
        .from('invitations')
        .update({ 
          status: 'ACCEPTED', 
          updated_at: new Date().toISOString(),
          responded_at: new Date().toISOString()
        })
        .eq('id', invitation.id);
    }
    
    // Add the user to the household
    const membershipId = generateUUID();
    const { error: joinError } = await supabaseClient
      .from('household_members')
      .insert([
        {
          id: membershipId,
          userId: session.user.id,
          householdId: invitation.householdId,
          role: invitation.role,
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