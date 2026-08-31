'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { apiUrl } from '../lib/api';
import { useCurrentUser } from '../lib/use-current-user';

export default function HomePage() {
  const state = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'authenticated') router.replace('/repositories');
  }, [state.status, router]);

  return (
    <div className="mx-auto max-w-2xl py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">AI-powered code review that understands your codebase</h1>
      <p className="mt-4 text-gray-400">
        Connect a GitHub repository, pick a branch, and get a review that checks the new code against your
        existing architecture and conventions — not just in isolation.
      </p>
      {state.status === 'unauthenticated' && (
        <a
          href={apiUrl('/api/auth/github')}
          className="mt-8 inline-block rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-500"
        >
          Log in with GitHub
        </a>
      )}
    </div>
  );
}
