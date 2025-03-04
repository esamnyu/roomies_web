// src/app/api/invitations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

// Generate a secure random token
function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

export async function POST(request: NextRequest) {
  console.log('[Invitations API] POST request received');
  
  try {
    // Log Next.js and Node versions
    console.log('[Invitations API] Node version:', process.version);
    console.log('[Invitations API] Next.js runtime:', process.env.NEXT_RUNTIME || 'unknown');
    
    // Log detailed information about the request
    console.log('[Invitations API] Request method:', request.method);
    console.log('[Invitations API] Request path:', request.nextUrl.pathname);
    console.log('[Invitations API] Request headers:', JSON.stringify([...request.headers.entries()]));
    
    // Log before creating Supabase client
    console.log('[Invitations API] Creating Supabase client - Starting');
    
    try {
      // Check cookies are accessible
      const cookieStore = await cookies();
      const availableCookies = cookieStore.getAll();
      console.log('[Invitations API] Available cookies count:', availableCookies.length);
      console.log('[Invitations API] Cookie names available:', availableCookies.map(c => c.name).join(', '));
      
      // Look specifically for Supabase auth cookies
      const authCookies = availableCookies.filter(c => c.name.includes('auth'));
      console.log('[Invitations API] Auth cookie names:', authCookies.map(c => c.name).join(', '));
    } catch (cookieError) {
      console.error('[Invitations API] Error accessing cookies:', cookieError);
    }
    
    // Create Supabase client with detailed error catching
    let supabase;
    try {
      console.log('[Invitations API] Initializing Supabase client with createRouteHandlerClient');
      supabase = createRouteHandlerClient({ cookies });
      console.log('[Invitations API] Supabase client created successfully');
    } catch (clientError) {
      console.error('[Invitations API] Failed to create Supabase client:', clientError);
      return NextResponse.json({ 
        error: 'Failed to initialize authentication client',
        details: clientError instanceof Error ? clientError.message : 'Unknown client error'
      }, { status: 500 });
    }
    
    // Get session with detailed logging
    console.log('[Invitations API] Getting auth session - Starting');
    let session;
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[Invitations API] Error getting session:', error);
        console.error('[Invitations API] Error details:', error.message);
        return NextResponse.json({ 
          error: 'Authentication error', 
          details: error.message 
        }, { status: 401 });
      }
      
      console.log('[Invitations API] Session data retrieved successfully');
      console.log('[Invitations API] Session exists:', !!data.session);
      
      session = data.session;
      
      if (!session) {
        console.log('[Invitations API] No active session found');
        
        // Check for auth cookies again to see if they're available but not valid
        const cookieStore = await cookies();
        const authCookies = cookieStore.getAll().filter(c => c.name.includes('auth'));
        if (authCookies.length > 0) {
          console.log('[Invitations API] Auth cookies present but no valid session - possible token expiration');
        } else {
          console.log('[Invitations API] No auth cookies found - user is not logged in');
        }
        
        return NextResponse.json({ error: 'Unauthorized - please log in' }, { status: 401 });
      }
      
      // Log successful authentication
      console.log('[Invitations API] User authenticated successfully:', session.user.id);
      console.log('[Invitations API] User email:', session.user.email);
      console.log('[Invitations API] Session expires at:', new Date(session.expires_at! * 1000).toISOString());
    } catch (sessionError) {
      console.error('[Invitations API] Critical error getting session:', sessionError);
      return NextResponse.json({ 
        error: 'Session retrieval error',
        details: sessionError instanceof Error ? sessionError.message : 'Unknown session error'
      }, { status: 500 });
    }
    
    // Get the invitation data from the request
    let invitationData;
    try {
      console.log('[Invitations API] Parsing request body');
      invitationData = await request.json();
      console.log('[Invitations API] Request payload:', JSON.stringify(invitationData));
    } catch (parseError) {
      console.error('[Invitations API] Error parsing request body:', parseError);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    const { 
      email, 
      householdId, 
      role = 'MEMBER', 
      message = '',
      expirationDays = 7
    } = invitationData;
    
    // Validate required fields with logging
    console.log('[Invitations API] Validating request data');
    console.log('[Invitations API] Email provided:', !!email);
    console.log('[Invitations API] HouseholdId provided:', !!householdId);
    
    if (!email || !householdId) {
      console.log('[Invitations API] Validation failed: Missing required fields');
      return NextResponse.json({ error: 'Missing required fields: email and householdId are required' }, { status: 400 });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[Invitations API] Validation failed: Invalid email format');
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    
    // Validate role
    const validRoles = ['ADMIN', 'MEMBER', 'GUEST'];
    if (!validRoles.includes(role)) {
      console.log('[Invitations API] Validation failed: Invalid role');
      return NextResponse.json({ error: 'Invalid role. Must be one of: ADMIN, MEMBER, GUEST' }, { status: 400 });
    }
    
    console.log('[Invitations API] Checking if user is household admin');
    
    // Check if the user is a member and admin of the household
    try {
      const { data: currentMembership, error: membershipError } = await supabase
        .from('HouseholdUser')
        .select('userId, role')
        .eq('userId', session.user.id)
        .eq('householdId', householdId)
        .single();
      
      if (membershipError) {
        console.error('[Invitations API] Error checking membership:', membershipError);
        console.error('[Invitations API] Error details:', membershipError.message);
        return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
      }
      
      console.log('[Invitations API] User role in household:', currentMembership.role);
      
      if (currentMembership.role !== 'ADMIN') {
        console.log('[Invitations API] Permission denied: User is not an admin');
        return NextResponse.json({ error: 'Only household admins can invite members' }, { status: 403 });
      }
      
      console.log('[Invitations API] User is confirmed as household admin');
    } catch (membershipCheckError) {
      console.error('[Invitations API] Error in membership check:', membershipCheckError);
      return NextResponse.json({ error: 'Error checking household membership' }, { status: 500 });
    }
    
    // Check if there's already a pending invitation for this email and household
    console.log('[Invitations API] Checking for existing invitation');
    try {
      const { data: existingInvitation, error: checkError } = await supabase
        .from('Invitation')
        .select('id, status')
        .eq('email', email)
        .eq('householdId', householdId)
        .eq('status', 'PENDING')
        .maybeSingle();
      
      if (checkError) {
        console.error('[Invitations API] Error checking existing invitations:', checkError);
      }
      
      if (existingInvitation) {
        console.log('[Invitations API] Found existing invitation:', existingInvitation.id);
        return NextResponse.json({ 
          error: 'An invitation has already been sent to this email for this household',
          invitationId: existingInvitation.id
        }, { status: 409 });
      }
      
      console.log('[Invitations API] No existing invitation found');
    } catch (checkError) {
      console.error('[Invitations API] Error checking existing invitation:', checkError);
      return NextResponse.json({ error: 'Error checking for existing invitations' }, { status: 500 });
    }
    
    // Check if the user is already a member of the household
    console.log('[Invitations API] Checking if email is already a household member');
    try {
      const { data: existingMember, error: memberError } = await supabase
        .from('User')
        .select('id')
        .eq('email', email)
        .single();
      
      if (existingMember && !memberError) {
        console.log('[Invitations API] Found existing user with this email:', existingMember.id);
        
        const { data: householdUser, error: householdUserError } = await supabase
          .from('HouseholdUser')
          .select('id')
          .eq('userId', existingMember.id)
          .eq('householdId', householdId)
          .maybeSingle();
        
        if (householdUser) {
          console.log('[Invitations API] User is already a member of this household');
          return NextResponse.json({ error: 'This user is already a member of the household' }, { status: 409 });
        }
        
        console.log('[Invitations API] User exists but is not a member of this household');
      } else {
        console.log('[Invitations API] No existing user found with this email');
      }
    } catch (memberCheckError) {
      console.error('[Invitations API] Error checking user membership:', memberCheckError);
      // Continue anyway - this is not a critical error
    }
    
    // For example, before creating the invitation:
    console.log('[Invitations API] All validations passed, creating invitation');
    
    // Generate a unique ID for the invitation
    const inviteId = crypto.randomUUID();
    console.log('[Invitations API] Generated invitation ID:', inviteId);
    
    // Generate a secure token for the invitation
    const token = generateToken();
    console.log('[Invitations API] Generated token (first 8 chars):', token.substring(0, 8));
    
    // Calculate expiration date
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(now.getDate() + expirationDays);
    console.log('[Invitations API] Setting expiration date:', expiresAt.toISOString());
    
    // Create the invitation record
    console.log('[Invitations API] Inserting invitation record into database');
    try {
      const { data: invitation, error: inviteError } = await supabase
        .from('Invitation')
        .insert([
          {
            id: inviteId,
            email,
            householdId,
            inviterId: session.user.id,
            role,
            status: 'PENDING',
            message: message || null,
            token,
            expiresAt: expiresAt.toISOString(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
          }
        ])
        .select('id, email, householdId, role, status, expiresAt, createdAt')
        .single();
      
      if (inviteError) {
        console.error('[Invitations API] Error creating invitation:', inviteError);
        console.error('[Invitations API] Error details:', inviteError.message, inviteError.code);
        return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
      }
      
      console.log('[Invitations API] Invitation created successfully:', invitation.id);
      
      // Return response
      console.log('[Invitations API] Returning success response');
      return NextResponse.json({
        ...invitation,
        message: 'Invitation created successfully'
      }, { status: 201 });
    } catch (dbError) {
      console.error('[Invitations API] Database error creating invitation:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    
  } catch (error) {
    console.error('[Invitations API] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to check invitation status with detailed logging
export async function GET(request: NextRequest) {
  console.log('[Invitations API] GET request received');
  
  try {
    // Log request details
    console.log('[Invitations API] Request path:', request.nextUrl.pathname);
    console.log('[Invitations API] Request method:', request.method);
    
    // Extract token from URL query
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    console.log('[Invitations API] Token provided:', !!token);
    
    if (!token) {
      console.log('[Invitations API] Error: Missing invitation token');
      return NextResponse.json({ error: 'Missing invitation token' }, { status: 400 });
    }
    
    // Create a Supabase client with detailed error catching
    let supabase;
    try {
      console.log('[Invitations API] Initializing Supabase client');
      
      // Check cookies are accessible
      const cookieStore = await cookies();
      const availableCookies = cookieStore.getAll();
      console.log('[Invitations API] Available cookies count:', availableCookies.length);
      
      supabase = createRouteHandlerClient({ cookies });
      console.log('[Invitations API] Supabase client created successfully');
    } catch (clientError) {
      console.error('[Invitations API] Failed to create Supabase client:', clientError);
      return NextResponse.json({ 
        error: 'Failed to initialize client',
        details: clientError instanceof Error ? clientError.message : 'Unknown client error'
      }, { status: 500 });
    }
    
    try {
      // Find the invitation by token
      console.log('[Invitations API] Looking up invitation by token');
      const { data: invitation, error } = await supabase
        .from('Invitation')
        .select('id, email, householdId, role, status, expiresAt')
        .eq('token', token)
        .single();
      
      if (error) {
        console.error('[Invitations API] Error looking up invitation:', error);
        console.error('[Invitations API] Error details:', error.message);
        return NextResponse.json({ error: 'Invalid or expired invitation token' }, { status: 404 });
      }
      
      if (!invitation) {
        console.log('[Invitations API] No invitation found with token');
        return NextResponse.json({ error: 'Invalid or expired invitation token' }, { status: 404 });
      }
      
      console.log('[Invitations API] Found invitation:', invitation.id);
      console.log('[Invitations API] Invitation status:', invitation.status);
      
      // Check if the invitation has expired
      const now = new Date();
      const expiry = new Date(invitation.expiresAt);
      console.log('[Invitations API] Current time:', now.toISOString());
      console.log('[Invitations API] Invitation expires:', expiry.toISOString());
      console.log('[Invitations API] Is expired:', expiry < now);
      
      if (expiry < now) {
        console.log('[Invitations API] Invitation has expired');
        return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
      }
      
      // Check if the invitation has already been used or cancelled
      if (invitation.status !== 'PENDING') {
        console.log('[Invitations API] Invitation is not pending - status:', invitation.status);
        return NextResponse.json({ 
          error: `Invitation is no longer valid (status: ${invitation.status})` 
        }, { status: 410 });
      }
      
      // Return the invitation details (without sensitive info)
      console.log('[Invitations API] Returning valid invitation data');
      return NextResponse.json({
        id: invitation.id,
        email: invitation.email,
        householdId: invitation.householdId,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt
      });
      
    } catch (error) {
      console.error('[Invitations API] Error validating invitation:', error);
      return NextResponse.json({ error: 'Error validating invitation' }, { status: 500 });
    }
  } catch (error) {
    console.error('[Invitations API] Unexpected error in GET handler:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Additional endpoint to accept an invitation with detailed logging
export async function PUT(request: NextRequest) {
  console.log('[Invitations API] PUT request received');
  
  try {
    // Log request details
    console.log('[Invitations API] Request path:', request.nextUrl.pathname);
    console.log('[Invitations API] Request method:', request.method);
    
    // Extract token from URL query
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    console.log('[Invitations API] Token provided:', !!token);
    
    if (!token) {
      console.log('[Invitations API] Error: Missing invitation token');
      return NextResponse.json({ error: 'Missing invitation token' }, { status: 400 });
    }
    
    // Create Supabase client with detailed error catching
    let supabase;
    try {
      console.log('[Invitations API] Initializing Supabase client');
      
      // Check cookies are accessible
      const cookieStore = await cookies();
      const availableCookies = cookieStore.getAll();
      console.log('[Invitations API] Available cookies count:', availableCookies.length);
      console.log('[Invitations API] Cookie names available:', availableCookies.map(c => c.name).join(', '));
      
      // Look specifically for Supabase auth cookies
      const authCookies = availableCookies.filter(c => c.name.includes('auth'));
      console.log('[Invitations API] Auth cookie names:', authCookies.map(c => c.name).join(', '));
      
      supabase = createRouteHandlerClient({ cookies });
      console.log('[Invitations API] Supabase client created successfully');
    } catch (clientError) {
      console.error('[Invitations API] Failed to create Supabase client:', clientError);
      return NextResponse.json({ 
        error: 'Failed to initialize client',
        details: clientError instanceof Error ? clientError.message : 'Unknown client error'
      }, { status: 500 });
    }
    
    // Get the current user's session with detailed logging
    console.log('[Invitations API] Getting auth session');
    let session;
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[Invitations API] Error getting session:', error);
        console.error('[Invitations API] Error details:', error.message);
        return NextResponse.json({ 
          error: 'Authentication error', 
          details: error.message 
        }, { status: 401 });
      }
      
      session = data.session;
      console.log('[Invitations API] Session exists:', !!session);
      
      if (!session) {
        console.log('[Invitations API] No active session found - authentication required');
        
        // Check for auth cookies to see if they're available but not valid
        const cookieStore = await cookies();
        const authCookies = cookieStore.getAll().filter(c => c.name.includes('auth'));
        if (authCookies.length > 0) {
          console.log('[Invitations API] Auth cookies present but no valid session - possible token expiration');
        } else {
          console.log('[Invitations API] No auth cookies found - user is not logged in');
        }
        
        return NextResponse.json({ error: 'Authentication required to accept invitation' }, { status: 401 });
      }
      
      // Log successful authentication
      console.log('[Invitations API] User authenticated successfully:', session.user.id);
      console.log('[Invitations API] User email:', session.user.email);
    } catch (sessionError) {
      console.error('[Invitations API] Critical error getting session:', sessionError);
      return NextResponse.json({ 
        error: 'Session retrieval error',
        details: sessionError instanceof Error ? sessionError.message : 'Unknown session error'
      }, { status: 500 });
    }
    
    try {
      // Get the invitation details
      console.log('[Invitations API] Looking up invitation by token');
      const { data: invitation, error: inviteError } = await supabase
        .from('Invitation')
        .select('*')
        .eq('token', token)
        .single();
        
      if (inviteError) {
        console.error('[Invitations API] Error looking up invitation:', inviteError);
        console.error('[Invitations API] Error details:', inviteError.message);
        return NextResponse.json({ error: 'Invalid or expired invitation token' }, { status: 404 });
      }
      
      if (!invitation) {
        console.log('[Invitations API] No invitation found with token');
        return NextResponse.json({ error: 'Invalid or expired invitation token' }, { status: 404 });
      }
      
      console.log('[Invitations API] Found invitation:', invitation.id);
      console.log('[Invitations API] Invitation details:', {
        email: invitation.email,
        householdId: invitation.householdId,
        status: invitation.status,
        role: invitation.role
      });
      
      // Check if the invitation has expired
      const now = new Date();
      const expiry = new Date(invitation.expiresAt);
      console.log('[Invitations API] Current time:', now.toISOString());
      console.log('[Invitations API] Invitation expires:', expiry.toISOString());
      console.log('[Invitations API] Is expired:', expiry < now);
      
      if (expiry < now) {
        console.log('[Invitations API] Invitation has expired');
        return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
      }
      
      // Check if the invitation is still pending
      if (invitation.status !== 'PENDING') {
        console.log('[Invitations API] Invitation is not pending - status:', invitation.status);
        return NextResponse.json({ 
          error: `Invitation is no longer valid (status: ${invitation.status})` 
        }, { status: 410 });
      }
      
      // Check if the logged-in user's email matches the invitation email
      console.log('[Invitations API] Checking if user email matches invitation email');
      console.log('[Invitations API] User email:', session.user.email);
      console.log('[Invitations API] Invitation email:', invitation.email);
      
      if (!session.user.email || session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        console.log('[Invitations API] Email mismatch - access denied');
        return NextResponse.json({ 
          error: 'You can only accept invitations sent to your email address' 
        }, { status: 403 });
      }
      
      console.log('[Invitations API] Email match confirmed - proceeding with acceptance');
      
      // Begin a transaction - add user to household and update invitation status
      console.log('[Invitations API] Adding user to household');
      try {
        const { error: memberError } = await supabase
          .from('HouseholdUser')
          .insert([{
            userId: session.user.id,
            householdId: invitation.householdId,
            role: invitation.role,
            joinedAt: new Date().toISOString()
          }]);
          
        if (memberError) {
          console.error('[Invitations API] Error adding user to household:', memberError);
          console.error('[Invitations API] Error code:', memberError.code);
          
          if (memberError.code === '23505') { // Unique constraint violation
            console.log('[Invitations API] User is already a member of this household');
            
            // Update invitation status to avoid repeat attempts
            console.log('[Invitations API] Updating invitation status to ACCEPTED anyway');
            await supabase
              .from('Invitation')
              .update({ 
                status: 'ACCEPTED', 
                updatedAt: new Date().toISOString() 
              })
              .eq('id', invitation.id);
              
            return NextResponse.json({ 
              error: 'You are already a member of this household' 
            }, { status: 409 });
          }
          
          return NextResponse.json({ 
            error: 'Failed to add you to the household',
            details: memberError.message
          }, { status: 500 });
        }
        
        console.log('[Invitations API] User successfully added to household');
      } catch (membershipError) {
        console.error('[Invitations API] Error in household membership operation:', membershipError);
        return NextResponse.json({ error: 'Error processing household membership' }, { status: 500 });
      }
      
      // Update invitation status
      console.log('[Invitations API] Updating invitation status to ACCEPTED');
      try {
        const { error: updateError } = await supabase
          .from('Invitation')
          .update({ 
            status: 'ACCEPTED', 
            updatedAt: new Date().toISOString() 
          })
          .eq('id', invitation.id);
          
        if (updateError) {
          console.error('[Invitations API] Error updating invitation status:', updateError);
          // Continue anyway as the user has been added to the household
        } else {
          console.log('[Invitations API] Invitation status updated successfully');
        }
      } catch (updateError) {
        console.error('[Invitations API] Error updating invitation:', updateError);
        // Continue anyway as the user has been added to the household
      }
      
      console.log('[Invitations API] Invitation acceptance process completed successfully');
      return NextResponse.json({ 
        message: 'Invitation accepted successfully',
        householdId: invitation.householdId
      });
      
    } catch (error) {
      console.error('[Invitations API] Error accepting invitation:', error);
      return NextResponse.json({ 
        error: 'Error accepting invitation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Invitations API] Unexpected error in PUT handler:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}