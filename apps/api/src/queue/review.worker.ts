import { Worker } from 'bullmq';
import { logger } from '../common/logger.js';
import { REVIEW_QUEUE_NAME, redisConnection } from './queue.js';
import { processReview } from './review.processor.js';

const CONCURRENCY = 2;

export function startReviewWorker(): Worker<{ reviewId: string }> {
  const worker = new Worker<{ reviewId: string }>(
    REVIEW_QUEUE_NAME,
    async (job) => {
      await processReview(job.data.reviewId);
    },
    { connection: redisConnection, concurrency: CONCURRENCY },
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'review job completed'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'review job failed'));

  return worker;
}
