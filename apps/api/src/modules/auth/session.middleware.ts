import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { parseCookies, serializeCookie } from '../../common/cookie.js';
import { unauthorized } from '../../common/errors.js';
import { asyncHandler } from '../../common/async-handler.js';

function readSessionId(req: Request): string | undefined {
  return parseCookies(req.headers.cookie)[env.SESSION_COOKIE_NAME];
}

/** Appends a Set-Cookie value without clobbering any already set on this response. */
export function appendSetCookie(res: Response, cookie: string): void {
  const existing = res.getHeader('Set-Cookie');
  const next = existing ? [...(Array.isArray(existing) ? existing : [String(existing)]), cookie] : [cookie];
  res.setHeader('Set-Cookie', next);
}

export function setSessionCookie(res: Response, sessionId: string): void {
  appendSetCookie(
    res,
    serializeCookie(env.SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: env.SESSION_TTL_HOURS * 60 * 60,
    }),
  );
}

export function clearSessionCookie(res: Response): void {
  appendSetCookie(
    res,
    serializeCookie(env.SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    }),
  );
}

/** Best-effort: attaches req.user/req.sessionId when a valid session cookie is present, otherwise leaves them unset. */
export const attachSession = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const sessionId = readSessionId(req);
  if (!sessionId) return next();

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return next();
  }

  req.sessionId = session.id;
  req.user = {
    id: session.user.id,
    githubId: session.user.githubId,
    githubLogin: session.user.githubLogin,
    name: session.user.name,
    avatarUrl: session.user.avatarUrl,
  };
  next();
});

/** Rejects the request unless `attachSession` found a valid session. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(unauthorized());
    return;
  }
  next();
}
