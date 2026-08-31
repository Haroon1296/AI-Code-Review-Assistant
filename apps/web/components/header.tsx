'use client';

import Link from 'next/link';
import { apiFetch, apiUrl } from '../lib/api';
import { useCurrentUser } from '../lib/use-current-user';

export function Header() {
  const state = useCurrentUser();

  async function handleLogout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    // Hard navigation (not router.push) is intentional: it fully resets client
    // state derived from the now-cleared session, e.g. useCurrentUser's cache.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/');
  }

  return (
    <header className="border-b border-border bg-panel">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-wide text-white">
          AI Code Review Assistant
        </Link>
        <nav className="flex items-center gap-6 text-sm text-gray-300">
          {state.status === 'authenticated' && (
            <>
              <Link href="/repositories" className="hover:text-white">
                Repositories
              </Link>
              <Link href="/reviews" className="hover:text-white">
                Reviews
              </Link>
              <div className="flex items-center gap-2">
                {state.user.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={state.user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
                )}
                <span>{state.user.githubLogin}</span>
                <button onClick={handleLogout} className="text-gray-400 hover:text-white">
                  Log out
                </button>
              </div>
            </>
          )}
          {state.status === 'unauthenticated' && (
            <a
              href={apiUrl('/api/auth/github')}
              className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-500"
            >
              Log in with GitHub
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
