import { Router } from 'express';
import { z } from 'zod';
import { CreateReviewRequestSchema, IssueCategory, IssueSeverity, ReviewStatus } from '@acra/types';
import { requireAuth } from '../auth/session.middleware.js';
import { validate } from '../../common/validate.js';
import { createReviewRateLimiter, postCommentRateLimiter } from '../../common/rate-limit.js';
import {
  getReview,
  getReviewArchitectureRoute,
  getReviewFilesRoute,
  getReviewIssuesRoute,
  getReviews,
  postReview,
  postReviewCommentRoute,
} from './reviews.controller.js';

const listQuerySchema = z.object({
  repositoryId: z.string().optional(),
  status: ReviewStatus.optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

const issuesQuerySchema = z.object({
  severity: IssueSeverity.optional(),
  category: IssueCategory.optional(),
});

export const reviewsRouter = Router();

reviewsRouter.use(requireAuth);

reviewsRouter.post('/', createReviewRateLimiter, validate(CreateReviewRequestSchema), postReview);
reviewsRouter.get('/', validate(listQuerySchema, 'query'), getReviews);
reviewsRouter.get('/:id', getReview);
reviewsRouter.get('/:id/issues', validate(issuesQuerySchema, 'query'), getReviewIssuesRoute);
reviewsRouter.get('/:id/files', getReviewFilesRoute);
reviewsRouter.get('/:id/architecture', getReviewArchitectureRoute);
reviewsRouter.post('/:id/post-comment', postCommentRateLimiter, postReviewCommentRoute);
