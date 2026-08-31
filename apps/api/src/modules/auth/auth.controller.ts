import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../common/async-handler.js';
import { parseCookies, serializeCookie } from '../../common/cookie.js';
import { badRequest } from '../../common/errors.js';
import type { AuthMeResponse } from '@acra/types';
import {
  buildGithubAuthorizeUrl,
  completeGithubOAuth,
  destroySession,
  generateOAuthState,
} from './auth.service.js';
import { appendSetCookie, clearSessionCookie, setSessionCookie } from './session.middleware.js';

const OAUTH_STATE_COOKIE = 'acra_oauth_state';

export const githubLogin = asyncHandler(async (_req: Request, res: Response) => {
  const state = generateOAuthState();
  appendSetCookie(
    res,
    serializeCookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 600,
    }),
  );
  res.redirect(buildGithubAuthorizeUrl(state));
});

export const githubCallback = asyncHandler(async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const cookies = parseCookies(req.headers.cookie);

  if (typeof code !== 'string' || typeof state !== 'string' || state !== cookies[OAUTH_STATE_COOKIE]) {
    throw badRequest('Invalid OAuth callback state', 'OAUTH_STATE_MISMATCH');
  }

  const { sessionId } = await completeGithubOAuth(code);

  appendSetCookie(res, serializeCookie(OAUTH_STATE_COOKIE, '', { path: '/api/auth', maxAge: 0 }));
  setSessionCookie(res, sessionId);
  res.redirect(env.FRONTEND_URL);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.sessionId) {
    await destroySession(req.sessionId);
  }
  clearSessionCookie(res);
  res.status(204).send();
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const body: AuthMeResponse = {
    id: user.id,
    githubLogin: user.githubLogin,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
  res.json(body);
});
