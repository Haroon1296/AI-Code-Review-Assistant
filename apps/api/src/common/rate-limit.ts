import rateLimit from 'express-rate-limit';

/** General API traffic. */
export const defaultRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Stricter limit on review creation — each one triggers a paid OpenAI call. */
export const createReviewRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many reviews requested. Try again later.', code: 'RATE_LIMITED' } },
});
