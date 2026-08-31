'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useCurrentUser } from '../lib/use-current-user';

export function AuthGuard({ children }: { children: ReactNode }) {
  const state = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'unauthenticated') router.replace('/');
  }, [state.status, router]);

  if (state.status !== 'authenticated') {
    return <div className="px-6 py-12 text-center text-sm text-gray-400">Loading...</div>;
  }

  return <>{children}</>;
}
