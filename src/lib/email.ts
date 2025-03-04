// src/lib/email.ts
import sgMail from '@sendgrid/mail';

// Initialize SendGrid with your API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface InvitationEmailParams {
  to: string;
  inviterName: string;
  householdName: string;
  invitationLink: string;
  role: string;
  message?: string;
}

/**
 * Send an invitation email to a potential roommate
 */
export async function sendInvitationEmail({
  to,
  inviterName,
  householdName,
  invitationLink,
  role,
  message
}: InvitationEmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not set, skipping email send');
    return false;
  }
  
  try {
    const formattedRole = role.charAt(0) + role.slice(1).toLowerCase();
    
    const msg = {
      to,
      from: {
        email: process.env.EMAIL_FROM || 'noreply@roomiesapp.com',
        name: 'Roomies App'
      },
      subject: `${inviterName} invited you to join ${householdName} on Roomies`,
      text: `
        Hello,
        
        ${inviterName} has invited you to join their household "${householdName}" on Roomies as a ${formattedRole}.
        
        ${message ? `Message from ${inviterName}: "${message}"` : ''}
        
        To accept this invitation, please click the link below:
        ${invitationLink}
        
        This invitation will expire in 30 days.
        
        If you don't have an account yet, you can create one when you open the invitation link.
        
        Thanks,
        The Roomies Team
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3B82F6;">You've Been Invited to Join a Household</h2>
          <p style="font-size: 16px; color: #333;">
            <strong>${inviterName}</strong> has invited you to join their household <strong>"${householdName}"</strong> 
            on Roomies as a ${formattedRole}.
          </p>
          
          ${message ? `
            <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-style: italic; color: #4B5563;">
                "${message}"
              </p>
              <p style="margin: 5px 0 0; text-align: right; font-size: 14px; color: #6B7280;">
                - ${inviterName}
              </p>
            </div>
          ` : ''}
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${invitationLink}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Accept Invitation
            </a>
          </div>
          
          <p style="font-size: 14px; color: #6B7280;">
            This invitation will expire in 30 days. If you don't have an account yet, you can create one when you open the invitation link.
          </p>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;" />
          
          <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
            &copy; Roomies App. All rights reserved.
          </p>
        </div>
      `
    };
    
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return false;
  }
}