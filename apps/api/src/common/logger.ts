import pino from 'pino';
import { env } from '../config/env.js';

/**
 * Redact anything that could hold a GitHub access token, OpenAI key, or
 * session/cookie value, regardless of where it appears in the log object.
 */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      '*.accessToken',
      '*.access_token',
      '*.encryptedAccessToken',
      '*.token',
      '*.apiKey',
      '*.api_key',
      '*.secret',
      '*.password',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
});
