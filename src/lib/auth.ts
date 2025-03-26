// src/lib/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseClient } from '@/lib/supabase';

/**
 * Error class for authentication errors
 */
export class AuthenticationError extends Error {
  status: number;
  
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.status = status;
  }
}

/**
 * Error class for authorization errors
 */
export class AuthorizationError extends Error {
  status: number;
  
  constructor(message: string, status: number = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.status = status;
  }
}

/**
 * Get the currently authenticated user from Next Auth
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    throw new AuthenticationError('Unauthorized - please log in');
  }
  
  return session.user;
}

/**
 * Create a Supabase client with the user's cookies
 */
export function getSupabaseClient() {
  const cookieStore = cookies();
  return createRouteHandlerClient({ cookies: () => cookieStore });
}

/**
 * Get the user's database entry from Supabase using their Next Auth email
 */
export async function getUserDbRecord(email: string) {
  const supabase = getSupabaseClient();
  
  const { data: userData, error: userError } = await supabase
    .from('User')
    .select('id, name, email, avatar')
    .eq('email', email)
    .single();
  
  if (userError || !userData) {
    throw new AuthenticationError('User account not found in database');
  }
  
  return userData;
}

/**
 * Check if a user is an admin of the specified household
 */
export async function verifyHouseholdAdmin(userId: string, householdId: string) {
  const { data: membership, error } = await supabaseClient
    .from('HouseholdUser')
    .select('role')
    .eq('userId', userId)
    .eq('householdId', householdId)
    .single();
  
  if (error || !membership) {
    throw new AuthorizationError('You are not a member of this household');
  }
  
  if (membership.role !== 'ADMIN') {
    throw new AuthorizationError('Only household admins can perform this action');
  }
  
  return true;
}

/**
 * Higher-order function for creating authenticated API handlers
 */
export function withAuth<T>(
  handler: (request: NextRequest, user: any) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    try {
      const user = await getCurrentUser();
      return await handler(request, user);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return NextResponse.json({ error: error.message }, { status: error.status }) as NextResponse<T>;
      }
      
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: error.message }, { status: error.status }) as NextResponse<T>;
      }
      
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' }, 
        { status: 500 }
      ) as NextResponse<T>;
    }
  };
}

/**
 * Higher-order function for creating handlers that require household admin permissions
 */
export function withHouseholdAdmin<T>(
  handler: (request: NextRequest, user: any, householdId: string) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    try {
      const user = await getCurrentUser();
      
      // Get household ID from URL or query params
      const url = new URL(request.url);
      const householdId = url.searchParams.get('householdId');
      
      if (!householdId) {
        return NextResponse.json(
          { error: 'Missing required householdId parameter' }, 
          { status: 400 }
        ) as NextResponse<T>;
      }
      
      // Get user's database record
      const userDb = await getUserDbRecord(user.email as string);
      
      // Verify user is a household admin
      await verifyHouseholdAdmin(userDb.id, householdId);
      
      // Call the handler with the user and household ID
      return await handler(request, userDb, householdId);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return NextResponse.json({ error: error.message }, { status: error.status }) as NextResponse<T>;
      }
      
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: error.message }, { status: error.status }) as NextResponse<T>;
      }
      
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' }, 
        { status: 500 }
      ) as NextResponse<T>;
    }
  };
}

/**
 * Create or get a user record in the database from a Next Auth session
 */
export async function ensureUserExists(user: any) {
  const supabase = getSupabaseClient();
  
  // Check if user already exists
  const { data: existingUser, error: userError } = await supabase
    .from('User')
    .select('id')
    .eq('email', user.email)
    .single();
  
  if (!userError && existingUser) {
    return existingUser.id;
  }
  
  // Create a new user record
  const { data: newUser, error: createError } = await supabase
    .from('User')
    .insert([
      {
        id: user.id || crypto.randomUUID(),
        email: user.email,
        name: user.name || user.email?.split('@')[0] || 'User',
        avatar: user.image || null,
        password: 'MANAGED_BY_AUTH_PROVIDER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ])
    .select('id')
    .single();
  
  if (createError || !newUser) {
    throw new Error('Failed to create user record');
  }
  
  return newUser.id;
}