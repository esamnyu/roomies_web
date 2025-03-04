// src/app/api/invitations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase';
import { generateUUID } from '@/lib/utils';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// POST /api/invitations - Create a new invitation
export async function POST(request: NextRequest) {
  try {
    // Create a Supabase client with the user's session
    const supabaseAuth = createServerComponentClient({ cookies });
    
    // Get the current user's session
    const { data: { session } } = await supabaseAuth.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { email, householdId, role = 'MEMBER', message } = await request.json();
    
    // Validate required fields
    if (!email || !householdId) {
      return NextResponse.json({ error: 'Email and household ID are required' }, { status: 400 });
    }

    // Check if the current user is an admin of the household
    const { data: membership, error: membershipError } = await supabaseClient
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', session.user.id)
      .eq('householdId', householdId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    if (membership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only household admins can send invitations' }, { status: 403 });
    }
    
    // Check if the user is already a member of the household
    const { data: existingMember, error: existingMemberError } = await supabaseClient
      .from('HouseholdUser')
      .select('userId')
      .eq('householdId', householdId)
      .eq('user.email', email)
      .single();
    
    if (existingMember) {
      return NextResponse.json({ error: 'This user is already a member of the household' }, { status: 400 });
    }
    
    // Check if there's already a pending invitation for this email and household
    const { data: existingInvitation, error: invitationError } = await supabaseClient
      .from('Invitation')
      .select('id, status')
      .eq('email', email)
      .eq('householdId', householdId)
      .eq('status', 'PENDING')
      .single();
    
    if (existingInvitation) {
      return NextResponse.json({ 
        error: 'An invitation has already been sent to this email',
        invitationId: existingInvitation.id
      }, { status: 400 });
    }
    
    // Get household details for the email
    const { data: household, error: householdError } = await supabaseClient
      .from('Household')
      .select('name')
      .eq('id', householdId)
      .single();
    
    if (householdError || !household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }
    
    // Generate a secure token for the invitation
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    // Create the invitation record
    const invitationId = generateUUID();
    const { data: invitation, error: createError } = await supabaseClient
      .from('Invitation')
      .insert([
        {
          id: invitationId,
          email,
          householdId,
          inviterId: session.user.id,
          role,
          status: 'PENDING',
          message,
          token,
          expiresAt: expiresAt.toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ])
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating invitation:', createError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }
    
    // In a production app, you would send an email here
    // For now, we'll just return the invitation with the token
    
    return NextResponse.json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        // Include the invitation link in the response
        invitationLink: `${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${token}`
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }
}

// GET /api/invitations - Get all invitations for the current user's households
export async function GET(request: NextRequest) {
  try {
    // Create a Supabase client with the user's session
    const supabaseAuth = createServerComponentClient({ cookies });
    
    // Get the current user's session
    const { data: { session } } = await supabaseAuth.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');
    const status = searchParams.get('status') || 'PENDING';
    
    // If householdId is provided, check if the user is a member
    if (householdId) {
      const { data: membership, error: membershipError } = await supabaseClient
        .from('HouseholdUser')
        .select('userId, role')
        .eq('userId', session.user.id)
        .eq('householdId', householdId)
        .single();
      
      if (membershipError || !membership) {
        return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
      }
      
      // Only admins can see all invitations
      if (membership.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only household admins can view invitations' }, { status: 403 });
      }
      
      // Get invitations for the specific household
      const { data: invitations, error: invitationError } = await supabaseClient
        .from('Invitation')
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
          updatedAt,
          inviter:inviterId(id, name, email, avatar)
        `)
        .eq('householdId', householdId)
        .eq('status', status)
        .order('createdAt', { ascending: false });
      
      if (invitationError) {
        console.error('Error fetching invitations:', invitationError);
        return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
      }
      
      return NextResponse.json(invitations);
    } else {
      // Get all households where the user is an admin
      const { data: adminHouseholds, error: householdError } = await supabaseClient
        .from('HouseholdUser')
        .select('householdId')
        .eq('userId', session.user.id)
        .eq('role', 'ADMIN');
      
      if (householdError || !adminHouseholds || adminHouseholds.length === 0) {
        return NextResponse.json([]);
      }
      
      const householdIds = adminHouseholds.map(h => h.householdId);
      
      // Get invitations for all households where the user is an admin
      const { data: invitations, error: invitationError } = await supabaseClient
        .from('Invitation')
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
          updatedAt,
          household:householdId(id, name),
          inviter:inviterId(id, name, email, avatar)
        `)
        .in('householdId', householdIds)
        .eq('status', status)
        .order('createdAt', { ascending: false });
      
      if (invitationError) {
        console.error('Error fetching invitations:', invitationError);
        return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
      }
      
      return NextResponse.json(invitations);
    }
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
  }
}