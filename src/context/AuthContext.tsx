// src/context/AuthContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabaseClient } from '@/lib/supabase'; // Ensure this path is correct
import { useRouter } from 'next/navigation';
import { Session, User, AuthChangeEvent, AuthSession } from '@supabase/supabase-js';

// Define the shape of the context
type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any, data: any }>;
  signOut: () => Promise<void>;
};

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start in loading state
  const router = useRouter();

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates if component unmounts

    // Function to get the current session and update state
    const getSessionAndSetState = async () => {
      try {
        console.log('AuthProvider: Getting session...');
        // Use getSession which reads from storage - fast
        const { data: { session: currentSession }, error } = await supabaseClient.auth.getSession();

        if (error) {
          console.error('AuthProvider: Error getting session:', error.message);
        }

        if (isMounted) {
          if (currentSession) {
            console.log('AuthProvider: Session found, user ID:', currentSession.user.id);
          } else {
            console.log('AuthProvider: No active session found.');
          }
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
        }
      } catch (err) {
        console.error('AuthProvider: Unexpected error in getSessionAndSetState:', err);
      } finally {
        // Only set loading to false once after initial check if component is still mounted
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Fetch initial session state
    getSessionAndSetState();

    // Set up the listener for auth state changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: AuthSession | null) => {
        console.log('AuthProvider: Auth state changed:', _event);
        if (session) {
          console.log('AuthProvider: New session state, user ID:', session.user.id);
        } else {
          console.log('AuthProvider: Session is now null (signed out or expired).');
        }
        // Update state based on the event
        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          // Keep loading false after initial load, unless a specific event requires it
          setIsLoading(false);

          // Redirect on SIGNED_OUT event
          if (_event === 'SIGNED_OUT') {
             router.push('/login'); // Redirect after state is updated
          }
        }
      }
    );

    // Cleanup function
    return () => {
      isMounted = false; // Mark as unmounted
      subscription?.unsubscribe(); // Unsubscribe the listener
    };
  }, [router]); // Add router to dependency array as it's used in the listener callback effect indirectly

  // Sign In function
  const signIn = async (email: string, password: string) => {
    console.log('AuthProvider: Signing in with email:', email);
    setIsLoading(true);
    try {
      // signInWithPassword will trigger onAuthStateChange on success
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('AuthProvider: Sign in error:', error);
        setIsLoading(false); // Stop loading on error
      } else {
        console.log('AuthProvider: Sign in initiated. Waiting for auth state change...');
        // Don't need to manually setSession/setUser here, onAuthStateChange handles it
      }
      return { error };
    } catch (err) {
      console.error('AuthProvider: Unexpected error during sign in:', err);
      setIsLoading(false);
      return { error: err };
    }
  };

  // Sign Up function - includes API call to your backend
  const signUp = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      console.log('AuthProvider: Signing up with email:', email);
      // signUp will trigger onAuthStateChange if email confirmation is not required,
      // otherwise user stays logged out until confirmed.
      const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { name }, // Include name in Supabase metadata if desired
          emailRedirectTo: `${window.location.origin}/auth/callback`, // For email confirmation flow
        }
      });

      if (signUpError) {
        console.error('AuthProvider: Sign up error:', signUpError);
        setIsLoading(false);
        return { data: null, error: signUpError };
      }

      // Important: If email confirmation is required, signUpData.user might exist but session will be null.
      // User is not truly "logged in" until confirmation.
      // Your API call should likely happen regardless of confirmation status to create the profile.
      if (signUpData.user) {
        console.log('AuthProvider: Supabase Auth user created/exists. Creating user profile via API...');
        try {
          // Call your API route to create the corresponding user profile in your DB
          const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: signUpData.user.id, email, name }),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            console.error('AuthProvider: API call to /api/users failed:', response.status, errorBody);
            // Decide how to handle this - maybe return a specific error?
            // For now, we'll let the original signUp success/error be the primary result.
            // Optionally: throw new Error('Failed to create user profile record.');
          } else {
             console.log('AuthProvider: User profile creation API call successful.');
          }
        } catch (apiError) {
          console.error('AuthProvider: Error calling /api/users:', apiError);
          // Return the API error, but sign up itself might have succeeded in Supabase Auth
          setIsLoading(false); // Stop loading on API error
          return { error: apiError, data: signUpData };
        }
      } else {
         // This case might occur if Supabase is configured to prevent sign-ups somehow
         console.warn('AuthProvider: Supabase signUp did not return a user object, though no error was reported.');
      }

      // If email confirmation is required, user/session state won't change yet.
      // If auto-confirm is on, onAuthStateChange will handle the login state.
      setIsLoading(false); // Stop loading after sign up process completes
      return { data: signUpData, error: signUpError };

    } catch (err) {
      console.error('AuthProvider: Unexpected error during sign up:', err);
      setIsLoading(false);
      return { error: err, data: null };
    }
  };

  // Sign Out function
  const signOut = async () => {
    console.log('AuthProvider: Signing out...');
    setIsLoading(true); // Optionally indicate loading during sign out
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        console.error('AuthProvider: Error signing out:', error);
        setIsLoading(false); // Stop loading on error
      }
      // State updates (user/session to null) and redirect are now handled by the
      // onAuthStateChange listener when it receives the 'SIGNED_OUT' event.
    } catch (err) {
      console.error('AuthProvider: Unexpected error during sign out:', err);
      setIsLoading(false);
    }
  };

  // Context value passed down
  const value = {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut,
  };

  // Render children only when initial loading is done
  return (
    <AuthContext.Provider value={value}>
      {!isLoading ? children : null /* Or a loading spinner */}
    </AuthContext.Provider>
  );
}

// Custom hook to use the context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // This error is correct and helps identify components rendered outside the provider
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};