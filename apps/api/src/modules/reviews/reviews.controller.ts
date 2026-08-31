import type { Request, Response } from 'express';
import type { ReviewSummaryDto } from '@acra/types';
import { asyncHandler } from '../../common/async-handler.js';
import { toArchitectureSnapshotDto } from '../analyzer/analyzer.mapper.js';
import {
  createReview,
  getReviewArchitecture,
  getReviewDetail,
  listReviewFiles,
  listReviewIssues,
  listReviewsForUser,
} from './reviews.service.js';
import { toReviewDetailDto, toReviewFileDto, toReviewIssueDto, toReviewSummaryDto } from './reviews.mapper.js';

export const postReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await createReview(req.user!.id, req.body);
  res.status(202).json({ id: review.id, status: review.status });
});

export const getReviews = asyncHandler(async (req: Request, res: Response) => {
  const { repositoryId, status, page, pageSize } = req.query as {
    repositoryId?: string;
    status?: ReviewSummaryDto['status'];
    page?: string;
    pageSize?: string;
  };

  const result = await listReviewsForUser(req.user!.id, {
    repositoryId,
    status,
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  });

  res.json({
    items: result.items.map(toReviewSummaryDto),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
});

export const getReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await getReviewDetail(req.user!.id, req.params.id as string);
  res.json(toReviewDetailDto(review));
});

export const getReviewIssuesRoute = asyncHandler(async (req: Request, res: Response) => {
  const { severity, category } = req.query as {
    severity?: Parameters<typeof listReviewIssues>[2]['severity'];
    category?: Parameters<typeof listReviewIssues>[2]['category'];
  };
  const issues = await listReviewIssues(req.user!.id, req.params.id as string, { severity, category });
  res.json(issues.map(toReviewIssueDto));
});

export const getReviewFilesRoute = asyncHandler(async (req: Request, res: Response) => {
  const files = await listReviewFiles(req.user!.id, req.params.id as string);
  res.json(files.map(toReviewFileDto));
});

export const getReviewArchitectureRoute = asyncHandler(async (req: Request, res: Response) => {
  const snapshot = await getReviewArchitecture(req.user!.id, req.params.id as string);
  res.json(snapshot ? toArchitectureSnapshotDto(snapshot) : null);
});
