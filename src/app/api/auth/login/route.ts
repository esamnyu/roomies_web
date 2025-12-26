// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find the user by email
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, name, password, avatar')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify the password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create a session using Supabase Auth
    const { data: session, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json(
        { message: 'Authentication failed' },
        { status: 500 }
      );
    }

    // Create a response object to set cookies
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      session: {
        expires: session.session.expires_at 
          ? new Date(session.session.expires_at * 1000).toISOString() 
          : null,
      },
    });

    // Set cookies on the response object directly
    response.cookies.set({
      name: 'sb-access-token',
      value: session.session.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    
    response.cookies.set({
      name: 'sb-refresh-token',
      value: session.session.refresh_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'An error occurred during login' },
      { status: 500 }
    );
  }
}