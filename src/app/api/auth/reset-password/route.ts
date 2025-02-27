// src/app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    // Validate input
    if (!token || !password) {
      return NextResponse.json(
        { message: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // In a real application, you would verify the token against your database
    // Here we're simulating token verification
    
    // For example:
    /*
    const resetRequest = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRequest) {
      return NextResponse.json(
        { message: 'Invalid or expired token' },
        { status: 400 }
      );
    }

    if (new Date() > resetRequest.expires) {
      return NextResponse.json(
        { message: 'Token has expired' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: resetRequest.email },
    });
    */
    
    // IMPORTANT: This is for demonstration only
    // In a real app, you would find the user based on the validated token
    // For this demo, let's assume the token is valid and we know the email
    const email = "demo@example.com"; // In a real app, this would come from the validated token
    
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // For security, use the same message even if the user doesn't exist
      return NextResponse.json(
        { message: 'Password reset successful' },
        { status: 200 }
      );
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update the user's password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // In a real app, you would also delete the used token
    // await prisma.passwordReset.delete({ where: { token } });

    return NextResponse.json(
      { message: 'Password reset successful' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { message: 'An error occurred while resetting your password' },
      { status: 500 }
    );
  }
}