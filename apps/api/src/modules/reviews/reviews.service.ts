import type { Repository, Review } from '@prisma/client';
import type { CreateReviewRequest, IssueCategory, IssueSeverity, ReviewStatus } from '@acra/types';
import { prisma } from '../../db/prisma.js';
import { badRequest, notFound } from '../../common/errors.js';
import { createGithubServiceForUser } from '../auth/auth.service.js';
import { requireConnectedRepository } from '../repositories/repositories.service.js';
import { enqueueReview } from '../../queue/queue.js';
import { EMPTY_TREE_SHA, WHOLE_BRANCH_BASE_LABEL } from './reviews.constants.js';
import { buildGithubCommentBody } from './github-comment-formatter.js';
import { isGithubNotFoundError, mapGithubCommentError } from './github-comment-error.js';
import { env } from '../../config/env.js';
import type { GithubService } from '../github/github.service.js';
import type { GithubComment } from '../github/github.types.js';

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

type CommentTarget = { type: 'pull_request'; number: number } | { type: 'commit'; sha: string };

async function resolveCommentTarget(
  github: GithubService,
  owner: string,
  repo: string,
  headBranch: string,
  headSha: string,
): Promise<CommentTarget> {
  const pr = await github.findOpenPullRequestForBranch(owner, repo, headBranch);
  return pr ? { type: 'pull_request', number: pr.number } : { type: 'commit', sha: headSha };
}

/**
 * The previously-posted comment's id, but only when it still points at the
 * place we're about to post to. For a pull request that means the *same* PR —
 * if the old one closed and a new one opened for this branch, editing the old
 * comment would leave nothing on the current PR.
 */
function reusableCommentId(review: Review, target: CommentTarget): number | null {
  if (!review.githubCommentId || review.githubCommentTarget !== target.type) return null;
  if (target.type === 'pull_request' && review.githubCommentPrNumber !== target.number) return null;
  return review.githubCommentId;
}

/** Tries to update the review's previously-posted comment; falls back to creating a new one if there wasn't one, or the stored comment was deleted upstream on GitHub. */
async function createOrUpdateComment(
  github: GithubService,
  owner: string,
  repo: string,
  target: CommentTarget,
  existingCommentId: number | null,
  body: string,
): Promise<GithubComment> {
  if (existingCommentId) {
    try {
      return target.type === 'pull_request'
        ? await github.updateIssueComment(owner, repo, existingCommentId, body)
        : await github.updateCommitComment(owner, repo, existingCommentId, body);
    } catch (err) {
      if (!isGithubNotFoundError(err)) throw err;
    }
  }

  return target.type === 'pull_request'
    ? await github.createIssueComment(owner, repo, target.number, body)
    : await github.createCommitComment(owner, repo, target.sha, body);
}

/** Every GitHub call for a post lives here, so all of their failures — the PR lookup included — map to this app's error conventions. */
async function postCommentToGithub(
  github: GithubService,
  review: Review & { repository: Repository },
  headSha: string,
  body: string,
): Promise<{ comment: GithubComment; target: CommentTarget }> {
  const { owner, name: repo } = review.repository;

  try {
    const target = await resolveCommentTarget(github, owner, repo, review.headBranch, headSha);
    const comment = await createOrUpdateComment(
      github,
      owner,
      repo,
      target,
      reusableCommentId(review, target),
      body,
    );
    return { comment, target };
  } catch (err) {
    throw mapGithubCommentError(err);
  }
}

export async function postReviewComment(userId: string, reviewId: string): Promise<Review> {
  const review = await requireOwnedReview(userId, reviewId);

  if (review.status !== 'completed') {
    throw badRequest('Review must be completed before posting to GitHub', 'REVIEW_NOT_COMPLETED');
  }
  if (!review.headSha) {
    throw badRequest('This review has no associated commit', 'MISSING_HEAD_SHA');
  }

  const issues = await prisma.reviewIssue.findMany({
    where: { reviewId },
    orderBy: { createdAt: 'asc' },
  });
  const body = buildGithubCommentBody(review, issues, `${env.FRONTEND_URL}/reviews/${review.id}`);

  const github = await createGithubServiceForUser(userId);
  const { comment, target } = await postCommentToGithub(github, review, review.headSha, body);

  // Deliberately outside the GitHub error mapping above: the comment is already
  // live at this point, so a failure here is a DB problem, not a GitHub one.
  return prisma.review.update({
    where: { id: reviewId },
    data: {
      githubCommentId: comment.id,
      githubCommentUrl: comment.url,
      githubCommentTarget: target.type,
      githubCommentPrNumber: target.type === 'pull_request' ? target.number : null,
      githubCommentPostedAt: new Date(),
    },
  });
}
