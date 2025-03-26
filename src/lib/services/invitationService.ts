// src/lib/services/invitationService.ts
import { randomBytes } from 'crypto';
import { generateUUID } from '@/lib/utils';
import { sendInvitationEmail } from '@/lib/email';

// Generate a secure random token
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

export class ValidationError extends Error {
  status: number;
  
  constructor(message: string, status: number = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

export class ResourceNotFoundError extends Error {
  status: number;
  
  constructor(message: string, status: number = 404) {
    super(message);
    this.name = 'ResourceNotFoundError';
    this.status = status;
  }
}

export class ConflictError extends Error {
  status: number;
  details?: any;
  
  constructor(message: string, details?: any, status: number = 409) {
    super(message);
    this.name = 'ConflictError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Validates invitation request data
 */
export function validateInvitationData(data: any) {
  const { email, householdId, role = 'MEMBER' } = data;
  
  if (!email || !householdId) {
    throw new ValidationError('Missing required fields: email and householdId are required');
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
  
  // Validate role
  const validRoles = ['ADMIN', 'MEMBER', 'GUEST'];
  if (!validRoles.includes(role)) {
    throw new ValidationError('Invalid role. Must be one of: ADMIN, MEMBER, GUEST');
  }
  
  return { email, householdId, role };
}

/**
 * Get invitation by token
 */
export async function getInvitationByToken(supabase: any, token: string) {
  const { data: invitation, error } = await supabase
    .from('Invitation')
    .select(`
      id, 
      email, 
      householdId, 
      role, 
      status, 
      expiresAt,
      createdAt,
      message,
      household:householdId(id, name, address),
      inviter:inviterId(id, name, email, avatar)
    `)
    .eq('token', token)
    .single();
  
  if (error) {
    throw new ResourceNotFoundError('Invalid or expired invitation token');
  }
  
  if (!invitation) {
    throw new ResourceNotFoundError('Invalid or expired invitation token');
  }
  
  return invitation;
}

/**
 * Check if an invitation has expired and update its status if needed
 */
export async function checkInvitationExpiration(supabase: any, invitation: any) {
  const now = new Date();
  const expiry = new Date(invitation.expiresAt);
  
  if (expiry < now) {
    // Auto-update status to EXPIRED
    await supabase
      .from('Invitation')
      .update({ 
        status: 'EXPIRED', 
        updatedAt: now.toISOString()
      })
      .eq('id', invitation.id);
      
    throw new ValidationError('Invitation has expired', 410);
  }
  
  // Check if the invitation has already been used or cancelled
  if (invitation.status !== 'PENDING') {
    throw new ValidationError(`Invitation is no longer valid (status: ${invitation.status})`, 410);
  }
  
  return invitation;
}

/**
 * Check for existing pending invitation
 */
export async function checkExistingInvitation(supabase: any, email: string, householdId: string) {
  const { data: existingInvitation, error } = await supabase
    .from('Invitation')
    .select('id, status')
    .eq('email', email)
    .eq('householdId', householdId)
    .eq('status', 'PENDING')
    .maybeSingle();
  
  if (existingInvitation) {
    throw new ConflictError(
      'An invitation has already been sent to this email for this household',
      { invitationId: existingInvitation.id }
    );
  }
  
  return null;
}

/**
 * Check if user is already a household member
 */
export async function checkExistingMembership(supabase: any, email: string, householdId: string) {
  try {
    const { data: existingUser, error: userError } = await supabase
      .from('User')
      .select('id')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      const { data: householdUser } = await supabase
        .from('HouseholdUser')
        .select('id')
        .eq('userId', existingUser.id)
        .eq('householdId', householdId)
        .maybeSingle();
      
      if (householdUser) {
        throw new ConflictError('This user is already a member of the household');
      }
    }
    
    return null;
  } catch (error) {
    // Only throw if it's a ConflictError; otherwise ignore
    if (error instanceof ConflictError) {
      throw error;
    }
    return null;
  }
}

/**
 * Create a new invitation
 */
export async function createInvitation(
  supabase: any, 
  data: any, 
  userId: string,
  userName: string,
  request: Request
) {
  const { 
    email, 
    householdId, 
    role = 'MEMBER', 
    message = '',
    expirationDays = 7
  } = data;
  
  // Check for existing invitation
  await checkExistingInvitation(supabase, email, householdId);
  
  // Check if user is already a member
  await checkExistingMembership(supabase, email, householdId);
  
  // Generate a unique ID for the invitation
  const inviteId = generateUUID();
  
  // Generate a secure token for the invitation
  const token = generateToken();
  
  // Calculate expiration date
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(now.getDate() + expirationDays);
  
  // Create the invitation record
  const { data: invitation, error: inviteError } = await supabase
    .from('Invitation')
    .insert([
      {
        id: inviteId,
        email,
        householdId,
        inviterId: userId,
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
    throw new Error('Failed to create invitation');
  }
  
  // Generate invitation link
  const url = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
  const invitationLink = `${baseUrl}/invite?token=${token}`;
  
  // Get household information for the email
  const { data: household } = await supabase
    .from('Household')
    .select('name')
    .eq('id', householdId)
    .single();
  
  // Send invitation email
  try {
    const emailSent = await sendInvitationEmail({
      to: email,
      inviterName: userName,
      householdName: household?.name || 'a household',
      invitationLink,
      role,
      message: message || undefined
    });
    
    return {
      invitation,
      invitationLink,
      message: 'Invitation created successfully',
      emailSent
    };
  } catch (error) {
    // Return success even if email fails
    return {
      invitation,
      invitationLink,
      message: 'Invitation created successfully, but failed to send email notification',
      emailSent: false
    };
  }
}

/**
 * Add a user to a household with a specific role
 */
export async function addUserToHousehold(
    supabase: any,
    userId: string,
    householdId: string,
    role: string
  ) {
    // Check if the user is already a member
    const { data: existingMembership } = await supabase
      .from('HouseholdUser')
      .select('id, role')
      .eq('userId', userId)
      .eq('householdId', householdId)
      .maybeSingle();
    
    if (existingMembership) {
      return {
        message: 'User is already a member of this household',
        role: existingMembership.role,
        householdId
      };
    }
    
    // Add the user to the household
    const membershipId = generateUUID();
    
    const { error: addError } = await supabase
      .from('HouseholdUser')
      .insert([
        {
          id: membershipId,
          userId,
          householdId,
          role,
          joinedAt: new Date().toISOString()
        }
      ]);
    
    if (addError) {
      throw new Error('Failed to add user to the household');
    }
    
    return {
      id: membershipId,
      userId,
      householdId,
      role,
      joinedAt: new Date().toISOString()
    };
  }

/**
 * Update invitation status (accept/decline)
 */
export async function updateInvitationStatus(
  supabase: any,
  invitationId: string,
  status: 'ACCEPTED' | 'DECLINED',
  userEmail: string
) {
  // Get the invitation
  const { data: invitation, error: fetchError } = await supabase
    .from('Invitation')
    .select('*')
    .eq('id', invitationId)
    .single();
  
  if (fetchError || !invitation) {
    throw new ResourceNotFoundError('Invitation not found');
  }
  
  // Check if the user is the recipient
  if (invitation.email !== userEmail) {
    throw new ValidationError('You can only respond to invitations sent to you', 403);
  }
  
  // Check if the invitation is still pending
  if (invitation.status !== 'PENDING') {
    throw new ValidationError('This invitation has already been processed');
  }
  
  // Check if the invitation has expired
  const now = new Date();
  const expiry = new Date(invitation.expiresAt);
  if (expiry < now) {
    throw new ValidationError('This invitation has expired');
  }
  
  // Update the invitation status
  const { data: updatedInvitation, error: updateError } = await supabase
    .from('Invitation')
    .update({ 
      status, 
      updatedAt: new Date().toISOString(),
      respondedAt: new Date().toISOString()
    })
    .eq('id', invitationId)
    .select()
    .single();
  
  if (updateError) {
    throw new Error('Failed to update invitation');
  }
  
  return updatedInvitation;
}

/**
 * Accept invitation by token
 */
export async function acceptInvitationByToken(
  supabase: any,
  token: string,
  user: any,
  claimWithCurrentEmail: boolean = false
) {
  // Find the invitation by token
  const invitation = await getInvitationByToken(supabase, token);
  
  // Check if invitation is valid and not expired
  await checkInvitationExpiration(supabase, invitation);
  
  // Check if the user's email matches the invitation email
  const userEmail = user.email || '';
  if (invitation.email.toLowerCase() !== userEmail.toLowerCase() && !claimWithCurrentEmail) {
    throw new ValidationError(
      'This invitation was sent to a different email address',
      403
    );
  }
  
  // Find or create user record
  const { data: existingUser, error: userError } = await supabase
    .from('User')
    .select('id')
    .eq('email', userEmail)
    .single();
    
  let userDbId;
  if (userError || !existingUser) {
    // Create a new user if not found
    const { data: newUser, error: createError } = await supabase
      .from('User')
      .insert([
        {
          id: user.id,
          email: userEmail,
          name: user.name || userEmail?.split('@')[0] || 'User',
          password: 'MANAGED_BY_SUPABASE_AUTH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ])
      .select('id')
      .single();
      
    if (createError || !newUser) {
      throw new Error('Failed to create user record');
    }
    
    userDbId = newUser.id;
  } else {
    userDbId = existingUser.id;
  }
  
  // Try to get any existing household membership
  const { data: existingMembership } = await supabase
    .from('HouseholdUser')
    .select('id, role')
    .eq('userId', userDbId)
    .eq('householdId', invitation.householdId)
    .maybeSingle();
  
  const now = new Date();
  
  if (existingMembership) {
    // Update the invitation status to ACCEPTED since we're effectively accepting it
    await supabase
      .from('Invitation')
      .update({ 
        status: 'ACCEPTED', 
        updatedAt: now.toISOString(),
        respondedAt: now.toISOString(),
        notes: claimWithCurrentEmail ? `Claimed by ${userEmail} (original recipient: ${invitation.email})` : undefined
      })
      .eq('id', invitation.id);
    
    return { 
      message: 'You are already a member of this household',
      role: existingMembership.role,
      householdId: invitation.householdId,
      redirectTo: `/dashboard/${invitation.householdId}`
    };
  }
  
  // Accept the invitation by updating status
  await supabase
    .from('Invitation')
    .update({ 
      status: 'ACCEPTED', 
      updatedAt: now.toISOString(),
      respondedAt: now.toISOString(),
      notes: claimWithCurrentEmail ? `Claimed by ${userEmail} (original recipient: ${invitation.email})` : undefined
    })
    .eq('id', invitation.id);
  
  // Add the user to the household
  const membershipId = generateUUID();
  
  const { error: addError } = await supabase
    .from('HouseholdUser')
    .insert([
      {
        id: membershipId,
        userId: userDbId,
        householdId: invitation.householdId,
        role: invitation.role,
        joinedAt: now.toISOString()
      }
    ]);
  
  if (addError) {
    throw new Error('Failed to add you to the household');
  }
  
  // Get household details to include in response
  const { data: household } = await supabase
    .from('Household')
    .select('name')
    .eq('id', invitation.householdId)
    .single();
  
  return {
    message: 'You have successfully joined the household',
    householdId: invitation.householdId,
    householdName: household?.name || 'Household',
    role: invitation.role,
    joinedAt: now.toISOString(),
    redirectTo: `/dashboard/${invitation.householdId}`
  };
}