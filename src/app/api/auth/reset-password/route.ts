// src/app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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
    // Here's how you might do that with a PasswordReset table in Supabase:
    /*
    const { data: resetRequest, error: tokenError } = await supabase
      .from('PasswordReset')
      .select('email, expires')
      .eq('token', token)
      .single();

    if (tokenError || !resetRequest) {
      return NextResponse.json(
        { message: 'Invalid or expired token' },
        { status: 400 }
      );
    }

    if (new Date() > new Date(resetRequest.expires)) {
      return NextResponse.json(
        { message: 'Token has expired' },
        { status: 400 }
      );
    }

    const email = resetRequest.email;
    */

    // IMPORTANT: This is for demonstration only
    // In a real app, you would find the user based on the validated token
    // For this demo, let's assume the token is valid and we know the email
    const email = "demo@example.com"; // In a real app, this would come from the validated token
    
    // Find the user with the email
    const { data: user, error: userError } = await supabase
      .from('User')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !user) {
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
    const { error: updateError } = await supabase
      .from('User')
      .update({ 
        password: hashedPassword,
        updatedAt: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json(
        { message: 'An error occurred while resetting your password' },
        { status: 500 }
      );
    }

    // In a real app, you would also delete the used token
    /*
    const { error: deleteError } = await supabase
      .from('PasswordReset')
      .delete()
      .eq('token', token);
    
    if (deleteError) {
      console.error('Error deleting used token:', deleteError);
      // Not returning an error to the client as the password reset was successful
    }
    */

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