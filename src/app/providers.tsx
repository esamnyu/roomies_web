// src/app/providers.tsx
'use client';

import { ReactNode } from 'react';
import { AuthProvider } from './providers/AuthProvider';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}