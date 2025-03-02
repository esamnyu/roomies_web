// src/app/auth/callback/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Handle the auth callback
    const handleCallback = async () => {
      try {
        // Parse the URL to extract code and next parameters
        const code = searchParams.get('code');
        const next = searchParams.get('next') || '/dashboard';

        if (code) {
          // Exchange the code for a session
          await supabaseClient.auth.exchangeCodeForSession(code);
          
          // Check if the user has been fully registered in the User table
          const { data: { session } } = await supabaseClient.auth.getSession();
          
          if (session) {
            // Check if the user exists in our database
            const { data: user, error: userError } = await supabaseClient
              .from('User')
              .select('id')
              .eq('id', session.user.id)
              .single();
            
            if (userError) {
              // User doesn't exist in our database yet - create them
              const { error: insertError } = await supabaseClient
                .from('User')
                .insert([
                  {
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                    password: 'MANAGED_BY_SUPABASE_AUTH',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  }
                ]);
              
              if (insertError) {
                console.error('Error creating user record:', insertError);
              }
            }
            
            // Show welcome message for newly verified users
            const isNewUser = searchParams.get('type') === 'signup';
            if (isNewUser) {
              router.push('/dashboard?verified=true');
            } else {
              router.push(next);
            }
          } else {
            // No session - redirect to login
            router.push('/login?error=verification_failed');
          }
        } else {
          // No code parameter - redirect to login
          router.push('/login');
        }
      } catch (error) {
        console.error('Error handling auth callback:', error);
        router.push('/login?error=callback_error');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">Roomies</h1>
        </div>
        <h2 className="mt-6 text-center text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Verifying your account
        </h2>
        <div className="mt-4 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Please wait while we verify your account...
        </p>
      </div>
    </div>
  );
}