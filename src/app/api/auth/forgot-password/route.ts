// src/app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

// In a real app, you would use a proper email service
// This is a simulated email function for demonstration purposes
async function sendPasswordResetEmail(email: string, token: string) {
  // In a real application, you would use a service like:
  // - SendGrid
  // - Nodemailer with SMTP
  // - Amazon SES
  // - etc.
  
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
  
  console.log(`
    Password reset link for ${email}:
    ${resetUrl}
    
    This would be sent via email in a production environment.
  `);
  
  // Return true to simulate successful email sending
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validate input
    if (!email) {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const { data: user, error } = await supabase
      .from('User')
      .select('id, email')
      .eq('email', email)
      .single();

    // Don't reveal if a user exists or not for security reasons
    // Always return a success message even if the user doesn't exist
    if (error || !user) {
      // For security, we don't want to reveal if the error is because the user doesn't exist
      // So we just log the error internally but return a generic success message
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
        console.error('Error checking user:', error);
      }
      
      return NextResponse.json(
        { message: 'If your email is registered, you will receive a password reset link shortly' },
        { status: 200 }
      );
    }

    // Generate a token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // Token expires in 1 hour

    // Store the reset token
    // Note: In a real application, you would have a separate table for this
    // If you need to implement this with Supabase, create a PasswordReset table

    /* 
    // Example of what the table creation might look like:
    CREATE TABLE "PasswordReset" (
      "email" TEXT PRIMARY KEY,
      "token" TEXT NOT NULL,
      "expires" TIMESTAMP WITH TIME ZONE NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    // Then you would use it like this:
    const { error: upsertError } = await supabase
      .from('PasswordReset')
      .upsert({
        email: email,
        token: token,
        expires: expires.toISOString()
      })

    if (upsertError) {
      console.error('Error storing reset token:', upsertError);
      return NextResponse.json(
        { message: 'Error processing password reset' },
        { status: 500 }
      );
    }
    */

    // Send password reset email
    await sendPasswordResetEmail(email, token);

    return NextResponse.json(
      { message: 'If your email is registered, you will receive a password reset link shortly' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { message: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}