// src/app/providers.tsx
'use client';

import { ReactNode } from 'react';
import { SessionProvider } from "next-auth/react"; // <--- Make sure this import exists
import { AuthProvider } from '@/context/AuthContext';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    // SessionProvider MUST wrap components using useSession
    <SessionProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </SessionProvider>
  );
}