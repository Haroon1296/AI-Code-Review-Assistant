import type { Review } from '@prisma/client';
import type { CreateReviewRequest, IssueCategory, IssueSeverity, ReviewStatus } from '@acra/types';
import { prisma } from '../../db/prisma.js';
import { badRequest, notFound } from '../../common/errors.js';
import { createGithubServiceForUser } from '../auth/auth.service.js';
import { requireConnectedRepository } from '../repositories/repositories.service.js';
import { enqueueReview } from '../../queue/queue.js';
import { EMPTY_TREE_SHA, WHOLE_BRANCH_BASE_LABEL } from './reviews.constants.js';

export async function createReview(userId: string, input: CreateReviewRequest): Promise<Review> {
  const repository = await requireConnectedRepository(userId, input.repositoryId);
  const github = await createGithubServiceForUser(userId);

  if (input.wholeBranch) {
    const headSha = await github
      .getBranchHeadSha(repository.owner, repository.name, input.headBranch)
      .catch(() => null);
    if (!headSha) {
      throw badRequest('The branch does not exist on this repository', 'BRANCH_NOT_FOUND');
    }

    const review = await prisma.review.create({
      data: {
        repositoryId: repository.id,
        userId,
        baseBranch: WHOLE_BRANCH_BASE_LABEL,
        headBranch: input.headBranch,
        baseSha: EMPTY_TREE_SHA,
        headSha,
        status: 'pending',
      },
    });

    await enqueueReview(review.id);
    return review;
  }

  const baseBranch = input.baseBranch ?? repository.defaultBranch;

  if (baseBranch === input.headBranch) {
    throw badRequest('Base and feature branch must be different', 'SAME_BRANCH');
  }

  const [baseSha, headSha] = await Promise.all([
    github.getBranchHeadSha(repository.owner, repository.name, baseBranch).catch(() => null),
    github.getBranchHeadSha(repository.owner, repository.name, input.headBranch).catch(() => null),
  ]);

  if (!baseSha || !headSha) {
    throw badRequest('One or both branches do not exist on this repository', 'BRANCH_NOT_FOUND');
  }

  const review = await prisma.review.create({
    data: {
      repositoryId: repository.id,
      userId,
      baseBranch,
      headBranch: input.headBranch,
      baseSha,
      headSha,
      status: 'pending',
    },
  });

  await enqueueReview(review.id);
  return review;
}

export interface ListReviewsFilter {
  repositoryId?: string;
  status?: ReviewStatus;
  page?: number;
  pageSize?: number;
}

export async function listReviewsForUser(userId: string, filter: ListReviewsFilter) {
  const page = filter.page ?? 1;
  const pageSize = Math.min(filter.pageSize ?? 20, 100);
  const where = { userId, repositoryId: filter.repositoryId, status: filter.status };

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { repository: true, _count: { select: { issues: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.review.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

async function requireOwnedReview(userId: string, reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { repository: true },
  });
  if (!review || review.userId !== userId) throw notFound('Review not found');
  return review;
}

export async function getReviewDetail(userId: string, reviewId: string) {
  return requireOwnedReview(userId, reviewId);
}

export async function listReviewIssues(
  userId: string,
  reviewId: string,
  filter: { severity?: IssueSeverity; category?: IssueCategory },
) {
  await requireOwnedReview(userId, reviewId);
  return prisma.reviewIssue.findMany({
    where: { reviewId, severity: filter.severity, category: filter.category },
    orderBy: { createdAt: 'asc' },
  });
}

export async function listReviewFiles(userId: string, reviewId: string) {
  await requireOwnedReview(userId, reviewId);
  return prisma.reviewFile.findMany({ where: { reviewId } });
}

export async function getReviewArchitecture(userId: string, reviewId: string) {
  const review = await requireOwnedReview(userId, reviewId);
  if (!review.architectureSnapshotId) return null;
  return prisma.architectureSnapshot.findUnique({ where: { id: review.architectureSnapshotId } });
}
