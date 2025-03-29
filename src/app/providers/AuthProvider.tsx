// src/app/providers/AuthProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
// *** FIX 1: Import createClient and types from @supabase/supabase-js ***
import { createClient, SupabaseClient, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Define user type (align with your User table structure)
type User = {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
};

// Define auth context type using imported types
type AuthContextType = {
  supabase: SupabaseClient; // Use imported SupabaseClient type
  session: Session | null; // Use imported Session type
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: { message: string; } | null }>;
  signOut: () => Promise<void>;
};

// *** FIX 2: Use createClient from @supabase/supabase-js ***
// Initialize with a default client instance
// Ensure your environment variables are available client-side (NEXT_PUBLIC_)
const defaultSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  supabase: defaultSupabase,
  session: null,
  user: null,
  isLoading: true,
  signIn: async () => ({ error: { message: 'Auth Context not initialized' } }),
  signOut: async () => {},
});

// Hook to use auth context
export const useAuth = () => useContext(AuthContext);

// Auth Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null); // Use imported Session type
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  // Create the client instance using createClient from @supabase/supabase-js
  const [supabase] = useState(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ));

  // Function to fetch user profile
  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    const { data: userData, error: userError } = await supabase
      .from('User') // Ensure this matches your table name
      .select('id, name, email, avatar')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user data:', userError);
      return null;
    }
    return userData ? { ...userData, email: userData.email || '' } : null;
  };

  // Check for user session on mount and listen for changes
  useEffect(() => {
    // *** FIX 3: Add type to event, prefix with _ if unused ***
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        setIsLoading(true);
        setSession(session); // Store the whole session object
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          setUser(profile); // Set user profile from DB
        } else {
          setUser(null); // Clear user if session is null
        }
        setIsLoading(false);
      }
    );

    // Cleanup on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]); // Depend only on supabase client instance

  // Sign in function
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      return { error: { message: error.message } };
    }
    router.refresh();
    return { error: null };
  };

  // Sign out function
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Context provider value
  const value = {
    supabase,
    session,
    user,
    isLoading,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading ? children : null /* Or show a loading indicator */}
    </AuthContext.Provider>
  );
}