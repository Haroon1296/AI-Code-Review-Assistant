import type { NextFunction, Request, Response } from 'express';
import { forbidden } from './errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Lightweight CSRF mitigation for a cookie-authenticated JSON API: mutating
 * requests must carry a custom header. Cross-site `<form>` submissions and
 * simple cross-site fetches cannot set custom headers without triggering a
 * CORS preflight, which our strict origin allowlist then rejects.
 */
export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  if (req.header('X-Requested-With') !== 'acra') {
    next(forbidden('Missing required request header', 'CSRF_HEADER_MISSING'));
    return;
  }
  next();
}
