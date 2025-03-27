// src/app/providers.tsx
'use client';

import { ReactNode } from 'react';
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from '@/context/AuthContext';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}