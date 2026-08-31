import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './common/logger.js';
import { errorHandler, notFoundHandler } from './common/error-handler.js';
import { defaultRateLimiter } from './common/rate-limit.js';
import { requireCsrfHeader } from './common/csrf.js';
import { attachSession } from './modules/auth/session.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { repositoriesRouter } from './modules/repositories/repositories.routes.js';
import { reviewsRouter } from './modules/reviews/reviews.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));
  app.use(defaultRateLimiter);
  app.use(requireCsrfHeader);
  app.use(attachSession);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRouter);
  app.use('/api/repositories', repositoriesRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/settings', settingsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
