// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcrypt';

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

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('User')
      .select('id')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
      console.error('Error checking existing user:', checkError);
      return NextResponse.json(
        { message: 'Error checking user existence' },
        { status: 500 }
      );
    }

    if (existingUser) {
      return NextResponse.json(
        { message: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create the user in Supabase
    const { data: newUser, error: insertError } = await supabase
      .from('User')
      .insert([
        {
          name,
          email,
          password: hashedPassword,
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