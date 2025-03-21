// src/lib/email.ts - temporary version without SendGrid dependency

interface InvitationEmailParams {
  to: string;
  inviterName: string;
  householdName: string;
  invitationLink: string;
  role: string;
  message?: string;
  expirationDays?: number;
}

/**
 * Mock implementation that logs emails instead of sending them
 */
export async function sendInvitationEmail({
  to,
  inviterName,
  householdName,
  invitationLink,
  role,
  message,
  expirationDays = 7
}: InvitationEmailParams): Promise<boolean> {
  // Log what would have been sent
  console.log('=== MOCK EMAIL SERVICE ===');
  console.log(`Would send invitation email to: ${to}`);
  console.log(`From: ${inviterName}`);
  console.log(`Household: ${householdName}`);
  console.log(`Role: ${role}`);
  console.log(`Link: ${invitationLink}`);
  if (message) console.log(`Message: ${message}`);
  console.log(`Expires in: ${expirationDays} days`);
  console.log('=========================');
  
  // Return success since we're just mocking
  return true;
}