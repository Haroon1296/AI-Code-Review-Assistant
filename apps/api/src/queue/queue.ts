import { Queue } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { env } from '../config/env.js';

export const REVIEW_QUEUE_NAME = 'review';

export const redisConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const reviewQueue = new Queue<{ reviewId: string }>(REVIEW_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 200 },
  },
});

export async function enqueueReview(reviewId: string): Promise<void> {
  await reviewQueue.add(REVIEW_QUEUE_NAME, { reviewId });
}
