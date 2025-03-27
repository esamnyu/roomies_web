// src/context/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Session, User } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any, data: any }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('Getting initial session...');
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        }
        
        if (session) {
          console.log('Session found, user ID:', session.user.id);
        } else {
          console.log('No session found');
        }
        
        setSession(session);
        setUser(session?.user ?? null);
      } catch (err) {
        console.error('Unexpected error getting session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event);
        if (session) {
          console.log('New session, user ID:', session.user.id);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('Signing in with email:', email);
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) {
        console.error('Sign in error:', error);
      } else {
        console.log('Sign in successful, session created:', !!data.session);
        // Make sure we update our local state with the new session
        setSession(data.session);
        setUser(data.user);
      }
      
      return { error };
    } catch (err) {
      console.error('Unexpected error during sign in:', err);
      return { error: err };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      console.log('Signing up with email:', email);
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            name
          },
          // Ensure cookies are persisted
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      // If successful, create a user record in your database
      if (data.user && !error) {
        console.log('Sign up successful, creating user record...');
        try {
          const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include', // Include cookies in the request
            body: JSON.stringify({
              id: data.user.id,
              email,
              name,
            }),
          });
          
          if (!response.ok) {
            console.error('Failed to create user record:', await response.text());
          }
        } catch (err) {
          console.error('Error creating user record:', err);
          return { error: err, data: null };
        }
      }

      return { data, error };
    } catch (err) {
      console.error('Unexpected error during sign up:', err);
      return { error: err, data: null };
    }
  };

  const signOut = async () => {
    console.log('Signing out...');
    try {
      await supabaseClient.auth.signOut();
      console.log('Sign out successful');
      setUser(null);
      setSession(null);
      router.push('/login');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};