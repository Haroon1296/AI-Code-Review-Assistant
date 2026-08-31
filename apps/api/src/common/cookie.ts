/**
 * Minimal cookie parse/serialize helpers. Written in-house instead of pulling
 * in the `cookie` package because its published versions ship no usable
 * TypeScript types under Node's `exports`-map resolution — the surface we
 * need (parse + a handful of Set-Cookie attributes) is small enough to own.
 */

export function parseCookies(header: string | undefined | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;

  for (const part of header.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    const name = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();
    if (!name) continue;
    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }

  return result;
}

export interface SerializeCookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  maxAge?: number;
}

export function serializeCookie(name: string, value: string, options: SerializeCookieOptions = {}): string {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.path) segments.push(`Path=${options.path}`);
  if (options.maxAge !== undefined) segments.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.httpOnly) segments.push('HttpOnly');
  if (options.secure) segments.push('Secure');
  if (options.sameSite) segments.push(`SameSite=${options.sameSite[0]!.toUpperCase()}${options.sameSite.slice(1)}`);

  return segments.join('; ');
}
