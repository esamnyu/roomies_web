// src/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Build-time check: Don't throw during static generation
const isBuildTime = !supabaseUrl || !supabaseAnonKey;

if (isBuildTime && typeof window === 'undefined') {
  console.warn('Missing required Supabase environment variables - this is expected during build');
}

// Lazy client creation to avoid build-time errors
let _supabaseClient: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

// Client for browser usage (with anonymous key)
export const supabaseClient = (() => {
  if (isBuildTime) {
    // Return a placeholder during build that will throw if actually used
    return createClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );
  }

  if (!_supabaseClient) {
    _supabaseClient = createClient(
      supabaseUrl!,
      supabaseAnonKey!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      }
    );
  }
  return _supabaseClient;
})();

// Admin client for server-side operations (with service role key)
export const supabase = (() => {
  if (isBuildTime) {
    return supabaseClient; // Use placeholder during build
  }

  if (!_supabaseAdmin) {
    _supabaseAdmin = supabaseServiceKey
      ? createClient(
          supabaseUrl!,
          supabaseServiceKey,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          }
        )
      : supabaseClient;
  }
  return _supabaseAdmin;
})();
