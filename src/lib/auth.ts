// src/lib/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
// Assuming supabaseAdmin is the client with SERVICE_ROLE_KEY from your lib/supabase.ts
import { supabase as supabaseAdmin } from '@/lib/supabase';

// --- Define User Type (align with your DB and Supabase Auth user) ---
// You might already have a better place for this, like src/types/index.ts
interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  // Add other fields from your 'User' table if needed
}

// --- Error Classes (Keep as they are useful) ---
export class AuthenticationError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.status = status;
  }
}

export class AuthorizationError extends Error {
  status: number;
  constructor(message: string, status: number = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.status = status;
  }
}

// --- Helper to create Supabase client within Route Handlers or Server Components ---
// Consistent with the pattern used in your API routes
const createSupabaseServerClient = async () => {
  const cookieStore = await cookies(); // Cannot be called at top level
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }); } catch (error) { console.error("Error setting cookie:", name, error); } },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }); } catch (error) { console.error("Error removing cookie:", name, error); } },
      },
    }
  );
};


/**
 * Get the currently authenticated Supabase user session data.
 * Use this in Route Handlers or Server Components where `cookies()` is available.
 */
export async function getCurrentSessionUser() {
  // Use dynamic client creation within the function
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error("Error fetching Supabase user:", error.message);
    throw new AuthenticationError('Failed to retrieve user session');
  }
  if (!user) {
    throw new AuthenticationError('Unauthorized - no active session found');
  }

  // Optional: Fetch profile details from your 'User' table if needed beyond auth user
  // const userProfile = await getUserProfile(user.id); // See getUserProfile below

  return user; // Returns Supabase Auth User object
  // return { ...user, profile: userProfile }; // Example if merging with profile
}

/**
 * Get the user's profile from the public 'User' table.
 * Uses the admin client to bypass RLS if needed, or SSR client if RLS allows.
 * Choose ONE client based on your RLS setup.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  // Option 1: Use SSR Client (Relies on RLS allowing user to read their own profile)
  // const supabase = createSupabaseServerClient();
  // const { data, error } = await supabase
  //   .from('profiles')
  //   .select('id, name, email, avatar')
  //   .eq('id', userId)
  //   .single();

  // Option 2: Use Admin Client (Bypasses RLS - use if RLS restricts profile reads)
   const { data, error } = await supabaseAdmin // Use admin client
     .from('profiles')
     .select('id, name, email, avatar') // Adjust fields as needed
     .eq('id', userId)
     .single();

  if (error) {
    console.error(`Error fetching user profile for ${userId}:`, error.message);
    // Don't throw Auth error here, just indicate profile fetch failed
    return null;
  }
  if (!data) {
      console.warn(`No user profile found in 'User' table for id ${userId}`);
      return null;
  }

  return data as UserProfile;
}

/**
 * Get the user's database profile entry using their Auth ID.
 * Combines fetching session and profile.
 * Use this in Route Handlers or Server Components.
 */
export async function getCurrentUserWithProfile(): Promise<{ auth: any; profile: UserProfile }> {
  const authUser = await getCurrentSessionUser(); // Get Supabase Auth User first

  // Fetch profile from your 'User' table
  const profile = await getUserProfile(authUser.id);

  if (!profile) {
    // Decide how to handle missing profile: throw error or return with null profile?
    // Throwing might be safer to ensure profile exists where needed.
    throw new Error(`User profile not found in database for authenticated user ${authUser.id}`);
  }

  return { auth: authUser, profile };
}

/**
 * Check if a user is an admin of the specified household.
 * Uses the Admin client to bypass RLS for checking HouseholdUser table reliably.
 */
export async function verifyHouseholdAdmin(userId: string, householdId: string): Promise<boolean> {
  // Use admin client for potentially restricted HouseholdUser table access
  const { data: membership, error } = await supabaseAdmin
    .from('household_members')
    .select('role')
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .single();

  if (error) {
    // Distinguish between "not found" and other errors
    if (error.code === 'PGRST116') { // code for "No rows returned"
      throw new AuthorizationError('You are not a member of this household');
    }
    console.error("Error verifying household admin:", error.message);
    throw new Error('Failed to verify household permissions');
  }

  if (!membership) { // Should be caught by PGRST116, but safety check
      throw new AuthorizationError('You are not a member of this household');
  }

  if (membership.role !== 'ADMIN') {
    throw new AuthorizationError('Only household admins can perform this action');
  }

  return true;
}

/**
 * Higher-order function for creating authenticated API handlers using Supabase Auth.
 */
export function withAuth<T = any>(
  // Handler expects the Supabase Auth User object and optionally the profile
  handler: (request: NextRequest, context: { params?: any }, session: { auth: any, profile: UserProfile | null }) => Promise<NextResponse<T>> | NextResponse<T>
) {
  return async (request: NextRequest, context: { params?: any }): Promise<NextResponse<T>> => {
    try {
      const authUser = await getCurrentSessionUser(); // Checks session validity
      const userProfile = await getUserProfile(authUser.id); // Fetch profile separately

      // Pass both auth user and profile (which might be null)
      return await handler(request, context, { auth: authUser, profile: userProfile });

    } catch (error: any) {
      console.error('[withAuth Error]:', error.message);
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        return NextResponse.json({ error: error.message }, { status: error.status }) as NextResponse<T>;
      }
      // Handle Supabase Auth errors specifically if needed
      // if (error.name === 'AuthApiError') { ... }

      return NextResponse.json(
        { error: 'Internal server error during authentication check' },
        { status: 500 }
      ) as NextResponse<T>;
    }
  };
}


/**
 * Higher-order function for creating handlers that require household admin permissions.
 * Assumes householdId is available, typically from URL parameters (context.params).
 */
export function withHouseholdAdmin<T = any>(
  // Handler expects Auth User, User Profile, and verified householdId
  handler: (request: NextRequest, context: { params?: any }, session: { auth: any, profile: UserProfile }, householdId: string) => Promise<NextResponse<T>> | NextResponse<T>
) {
  return async (request: NextRequest, context: { params?: any }): Promise<NextResponse<T>> => {
    try {
      const { auth: authUser, profile } = await getCurrentUserWithProfile(); // Ensures user is logged in and profile exists

      // --- Get householdId ---
      // Option 1: From URL path parameter (e.g., /api/households/[id]/...)
      const householdIdFromParams = context.params?.id || context.params?.householdId;

      // Option 2: From query string (e.g., /api/some-route?householdId=...)
      const householdIdFromQuery = request.nextUrl.searchParams.get('household_id');

      // Choose the source based on your API structure, prioritizing path params
      const householdId = householdIdFromParams || householdIdFromQuery;

      if (!householdId) {
        return NextResponse.json(
          { error: 'Missing required householdId parameter in URL path or query string' },
          { status: 400 }
        ) as NextResponse<T>;
      }
      // --- End Get householdId ---


      // Verify the user is an admin for this specific household
      await verifyHouseholdAdmin(authUser.id, householdId);

      // Call the actual handler, passing the authenticated user, profile, and verified householdId
      return await handler(request, context, { auth: authUser, profile }, householdId);

    } catch (error: any) {
      console.error('[withHouseholdAdmin Error]:', error.message);
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        return NextResponse.json({ error: error.message }, { status: error.status }) as NextResponse<T>;
      }
       // Handle Supabase Auth errors specifically if needed

      return NextResponse.json(
        { error: 'Internal server error during admin authorization check' },
        { status: 500 }
      ) as NextResponse<T>;
    }
  };
}


/**
 * Ensures a user profile exists in the public 'User' table after Supabase Auth sign-up/sign-in.
 * Should typically be called via a trigger/function in Supabase DB for robustness,
 * but can be called from backend code if necessary (e.g., after social login).
 *
 * @param authUser - The Supabase Auth User object (must contain id and email).
 * @param profileData - Optional additional data (like name, avatar) to insert/update.
 * @returns The user ID from the 'User' table.
 */
export async function ensureUserProfileExists(
    authUser: { id: string; email?: string | null; user_metadata?: { name?: string, avatar_url?: string } },
    profileData: Partial<UserProfile> = {}
): Promise<string> {
    if (!authUser || !authUser.id) {
        throw new Error('Valid Supabase Auth User object with ID is required.');
    }

    const userId = authUser.id;
    const userEmail = authUser.email || null;
    // Extract name/avatar from user_metadata if available (common with social auth)
    const userName = profileData.name ?? authUser.user_metadata?.name ?? userEmail?.split('@')[0] ?? 'New User';
    const userAvatar = profileData.avatar ?? authUser.user_metadata?.avatar_url ?? null;

    // Use Admin Client to perform upsert, bypassing RLS if necessary
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .upsert(
            {
                id: userId, // Match based on the Auth user ID
                email: userEmail,
                name: userName,
                avatar: userAvatar,
                // Add other default fields for your User table if needed on creation
                // password: 'SUPABASE_AUTH' // Can be set here or via default value in DB
                updated_at: new Date().toISOString(), // Explicitly set update timestamp
            },
            {
                onConflict: 'id', // Specify the conflict target
                // ignoreDuplicates: false // Default is false, ensures update happens if exists
            }
        )
        .select('id') // Select only the id after upsert
        .single();

    if (error) {
        console.error(`Error ensuring user profile exists for ${userId}:`, error.message);
        throw new Error('Failed to create or update user profile record');
    }
    if (!data) {
         console.error(`Upsert operation for user profile ${userId} did not return data.`);
         throw new Error('Failed to create or update user profile record');
    }

    console.log(`User profile ensured for ID: ${data.id}`);
    return data.id; // Return the user ID from the User table
}