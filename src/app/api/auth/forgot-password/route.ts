// src/app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Don't reveal if a user exists or not for security reasons
    // Always return a success message even if the user doesn't exist
    if (!user) {
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
    // Note: In a real application, you would have a separate table/model for this
    // For this demo, we're simulating it with console output
    
    // The token would be stored like this:
    /*
    await prisma.passwordReset.upsert({
      where: { email },
      update: {
        token,
        expires,
      },
      create: {
        email,
        token,
        expires,
      },
    });
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