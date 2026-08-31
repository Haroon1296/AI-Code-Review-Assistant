import { logger } from './common/logger.js';
import { startReviewWorker } from './queue/review.worker.js';

const worker = startReviewWorker();
logger.info('review worker started');

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
