'use client';

import { useEffect, useState } from 'react';
import type { AuthMeResponse } from '@acra/types';
import { apiFetch, ApiRequestError } from './api';

export type CurrentUserState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: AuthMeResponse }
  | { status: 'unauthenticated' };

export function useCurrentUser(): CurrentUserState {
  const [state, setState] = useState<CurrentUserState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    apiFetch<AuthMeResponse>('/api/auth/me')
      .then((user) => {
        if (!cancelled) setState({ status: 'authenticated', user });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError && err.status === 401) {
          setState({ status: 'unauthenticated' });
        } else {
          setState({ status: 'unauthenticated' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
