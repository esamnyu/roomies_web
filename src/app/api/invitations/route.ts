// src/app/api/invitations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getUserDbRecord } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/auth';
import { 
  getInvitationByToken, 
  checkInvitationExpiration,
  validateInvitationData,
  createInvitation,
  updateInvitationStatus,
  acceptInvitationByToken
} from '@/lib/services/invitationService';
import { handleApiError } from '@/lib/errorhandler';

// GET /api/invitations - Get all invitations for the current user or for a household
export const GET = withAuth(async (request: NextRequest, user: any) => {
  try {
    const supabase = getSupabaseClient();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');
    const status = searchParams.get('status') || 'PENDING'; // Default to pending invitations
    const tokenParam = searchParams.get('token');
    
    // If token is provided, get invitation by token
    if (tokenParam) {
      try {
        const invitation = await getInvitationByToken(supabase, tokenParam);
        await checkInvitationExpiration(supabase, invitation);
        
        // Return the invitation details (without sensitive info like the token)
        return NextResponse.json({
          id: invitation.id,
          email: invitation.email,
          householdId: invitation.householdId,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          message: invitation.message,
          createdAt: invitation.createdAt,
          household: invitation.household,
          inviter: invitation.inviter
        });
      } catch (error) {
        return handleApiError(error);
      }
    }
    
    // Build base query
    let query = supabase
      .from('Invitation')
      .select(`
        *,
        household:householdId(*),
        inviter:inviterId(id, name, email, avatar)
      `);
    
    if (householdId) {
      // Get invitations for a specific household - requires admin permission
      try {
        // Get the user's database record
        const userData = await getUserDbRecord(user.email);
        
        // Check if user is admin of this household
        const { data: householdRole, error: roleError } = await supabase
          .from('HouseholdUser')
          .select('role')
          .eq('userId', userData.id)
          .eq('householdId', householdId)
          .single();
        
        if (roleError || (householdRole?.role !== 'ADMIN')) {
          return NextResponse.json({ 
            error: 'You must be a household admin to view these invitations' 
          }, { status: 403 });
        }
        
        // Get invitations for the household
        query = query
          .eq('householdId', householdId)
          .eq('status', status);
      } catch (error) {
        return handleApiError(error);
      }
    } else {
      // Get invitations for the current user
      query = query
        .eq('email', user.email || '')
        .eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }
    
    return NextResponse.json(data || []);
  } catch (error) {
    return handleApiError(error);
  }
});

// POST /api/invitations - Create a new invitation
export const POST = withAuth(async (request: NextRequest, user: any) => {
  try {
    const supabase = getSupabaseClient();
    
    // Get the invitation data from the request
    const invitationData = await request.json();
    
    // Validate the data
    validateInvitationData(invitationData);
    
    // Get the user's database record
    const userData = await getUserDbRecord(user.email);
    
    // Check if the user is a member and admin of the household
    const { data: currentMembership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', userData.id)
      .eq('householdId', invitationData.householdId)
      .single();
    
    if (membershipError || !currentMembership) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    if (currentMembership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only household admins can invite members' }, { status: 403 });
    }
    
    // Create the invitation
    const result = await createInvitation(
      supabase, 
      invitationData, 
      userData.id,
      userData.name || user.name || user.email || 'User',
      request
    );
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
});

// PATCH /api/invitations/[id] - Update an invitation status (accept or decline)
export const PATCH = withAuth(async (request: NextRequest, user: any) => {
  try {
    // Extract invitation ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const invitationId = pathParts[pathParts.length - 1];
    
    if (!invitationId || pathParts[pathParts.length - 2] !== 'invitations') {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }
    
    const supabase = getSupabaseClient();
    
    // Get the request body
    const requestData = await request.json();
    const { status } = requestData;
    
    // Validate the status
    if (!status || !['ACCEPTED', 'DECLINED'].includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status value. Must be ACCEPTED or DECLINED' 
      }, { status: 400 });
    }
    
    // Update the invitation
    const updatedInvitation = await updateInvitationStatus(
      supabase,
      invitationId,
      status as 'ACCEPTED' | 'DECLINED',
      user.email
    );
    
    // If accepted, add the user to the household
    if (status === 'ACCEPTED') {
      // This logic is quite complex, so we'll keep it in the route handler for now
      // First get or create the user record in the database
      const userData = await getUserDbRecord(user.email);
      
      // Add the user to the household and return response
      // This part could also be moved to the service in a more complete refactoring
      
      return NextResponse.json({
        message: `Invitation accepted successfully`,
        invitation: updatedInvitation,
        redirectTo: `/dashboard/${updatedInvitation.householdId}`
      });
    }
    
    return NextResponse.json({
      message: `Invitation ${status.toLowerCase()} successfully`,
      invitation: updatedInvitation
    });
  } catch (error) {
    return handleApiError(error);
  }
});

// PUT endpoint to accept an invitation with token
export const PUT = withAuth(async (request: NextRequest, user: any) => {
  try {
    // Extract token from URL query
    const { searchParams } = new URL(request.url);
    const tokenParam = searchParams.get('token');
    
    if (!tokenParam) {
      return NextResponse.json({ error: 'Missing invitation token' }, { status: 400 });
    }
    
    const supabase = getSupabaseClient();
    
    // Check if the user wants to claim with a different email
    let claimWithCurrentEmail = false;
    try {
      const requestBody = await request.json();
      claimWithCurrentEmail = !!requestBody.claimWithCurrentEmail;
    } catch (e) {
      // No body or invalid JSON, so no claim requested
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
    return handleApiError(error);
  }
});

// GET /api/invitations/count - Get pending invitations count
// This should be moved to a separate route file
export const GET_COUNT = withAuth(async (request: NextRequest, user: any) => {
  try {
    const supabase = getSupabaseClient();
    
    // Get the count of pending invitations for the user
    const { count, error } = await supabase
      .from('Invitation')
      .select('*', { count: 'exact', head: true })
      .eq('email', user.email)
      .eq('status', 'PENDING');
    
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch invitation count' }, { status: 500 });
    }
    
    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    return handleApiError(error);
  }
});