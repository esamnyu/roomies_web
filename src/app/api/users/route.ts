// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcrypt';

export async function POST(request: NextRequest) {
  try {
    const { id, name, email } = await request.json();

    // Validate input
    if (!id || !name || !email) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create the user record in your database
    // Note: Password is already stored in Supabase Auth
    const { data: newUser, error: insertError } = await supabase
      .from('profiles')
      .insert([
        {
          id, // Use the ID provided by Supabase Auth
          name,
          email,
          password: 'MANAGED_BY_SUPABASE_AUTH', // Placeholder - password is managed by Auth service
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select('id, name, email, avatar, createdAt, updatedAt')
      .single();

    if (insertError) {
      console.error('Error creating user:', insertError);
      return NextResponse.json(
        { message: 'Error creating user' },
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