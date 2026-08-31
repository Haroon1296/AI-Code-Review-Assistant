import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/logger.js';

const app = createApp();

app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, 'API server listening');
});
