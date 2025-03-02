// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Step 1: Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
        }
      }
    });

    if (authError) {
      // Check if it's a duplicate email error
      if (authError.message.includes('email already')) {
        return NextResponse.json(
          { message: 'User with this email already exists' },
          { status: 409 }
        );
      }

      console.error('Error creating Supabase Auth user:', authError);
      return NextResponse.json(
        { message: 'Error registering user' },
        { status: 500 }
      );
    }

    // Make sure we have a user
    if (!authData.user) {
      return NextResponse.json(
        { message: 'Failed to create user account' },
        { status: 500 }
      );
    }

    // Step 2: Create a corresponding record in the User table
    // Use the Supabase Auth user's ID for the user record
    const userId = authData.user.id;
    
    // Let Supabase handle the timestamps by using its defaults
    const { data: newUser, error: insertError } = await supabase
      .from('User')
      .insert([
        {
          id: userId,
          name,
          email,
          password: 'SUPABASE_AUTH',
          // Don't specify createdAt and updatedAt - let Supabase handle them
        }
      ])
      .select('id, name, email, avatar, createdAt, updatedAt')
      .single();

    if (insertError) {
      console.error('Error creating user in User table:', insertError);
      console.error('Full error details:', JSON.stringify(insertError, null, 2));
      console.error('Attempted to insert user with ID:', userId);
      
      // If we failed to create the user record, clean up by deleting the auth user
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }

      return NextResponse.json(
        { message: 'Error creating user profile', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'User registered successfully',
        user: newUser
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { message: 'Error registering user' },
      { status: 500 }
    );
  }
}