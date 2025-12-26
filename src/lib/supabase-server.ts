// src/lib/supabase-server.ts
// Shared utilities for server-side Supabase operations

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { User } from '@supabase/supabase-js';

// ============================================================================
// Supabase Client Creation
// ============================================================================

/**
 * Creates a Supabase client for use in API Route Handlers and Server Components.
 * Uses the getAll/setAll cookie pattern required by Next.js 15.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookie setting may fail in certain contexts (e.g., after response started)
          }
        },
      },
    }
  );
}

// ============================================================================
// Auth Wrappers for API Routes
// ============================================================================

type AuthenticatedHandler = (
  request: NextRequest,
  user: User,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) => Promise<NextResponse>;

type AuthenticatedHandlerWithParams<T> = (
  request: NextRequest,
  user: User,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  params: T
) => Promise<NextResponse>;

/**
 * Wraps an API route handler with authentication.
 * Returns 401 if user is not authenticated.
 *
 * @example
 * export const GET = withAuth(async (request, user, supabase) => {
 *   // user is guaranteed to be authenticated
 *   return NextResponse.json({ userId: user.id });
 * });
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const supabase = await createSupabaseServerClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      return handler(request, user, supabase);
    } catch (error) {
      console.error('Auth wrapper error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

/**
 * Wraps an API route handler with authentication, supporting route params.
 * Use this for dynamic routes like /api/households/[id].
 *
 * @example
 * export const GET = withAuthParams<{ id: string }>(async (request, user, supabase, params) => {
 *   const { id } = await params;
 *   return NextResponse.json({ householdId: id });
 * });
 */
export function withAuthParams<T>(handler: AuthenticatedHandlerWithParams<T>) {
  return async (
    request: NextRequest,
    context: { params: T }
  ): Promise<NextResponse> => {
    try {
      const supabase = await createSupabaseServerClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      return handler(request, user, supabase, context.params);
    } catch (error) {
      console.error('Auth wrapper error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

// ============================================================================
// Household Access Checks
// ============================================================================

export interface HouseholdMembership {
  user_id: string;
  household_id: string;
  role: string;
}

export interface AccessCheckResult {
  authorized: boolean;
  membership?: HouseholdMembership;
  error?: string;
  status?: number;
}

/**
 * Checks if a user is a member of a household.
 * Optionally requires admin role.
 *
 * @example
 * const access = await checkHouseholdAccess(supabase, householdId, user.id);
 * if (!access.authorized) {
 *   return NextResponse.json({ error: access.error }, { status: access.status });
 * }
 */
export async function checkHouseholdAccess(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  householdId: string,
  userId: string,
  requireAdmin = false
): Promise<AccessCheckResult> {
  const { data: membership, error } = await supabase
    .from('household_members')
    .select('user_id, household_id, role')
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .maybeSingle();

  if (error) {
    console.error('Error checking household membership:', error);
    return {
      authorized: false,
      error: 'Failed to verify household membership.',
      status: 500
    };
  }

  if (!membership) {
    return {
      authorized: false,
      error: 'You are not a member of this household.',
      status: 403
    };
  }

  if (requireAdmin && membership.role !== 'admin') {
    return {
      authorized: false,
      error: 'Only household admins can perform this action.',
      status: 403
    };
  }

  return { authorized: true, membership };
}

/**
 * Gets the user's current/most recent household.
 * Returns null if user has no household.
 */
export async function getUserCurrentHousehold(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<{ household_id: string; role: string } | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Standard error response helper.
 */
export function errorResponse(message: string, status: number = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standard success response helper.
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}
