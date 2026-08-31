import type { Repository, Review, ReviewFile, ReviewIssue } from '@prisma/client';
import type { ReviewDetailDto, ReviewFileDto, ReviewIssueDto, ReviewSummaryDto } from '@acra/types';

export function toReviewSummaryDto(
  review: Review & { repository: Repository; _count: { issues: number } },
): ReviewSummaryDto {
  return {
    id: review.id,
    repositoryFullName: review.repository.fullName,
    baseBranch: review.baseBranch,
    headBranch: review.headBranch,
    status: review.status,
    score: review.score,
    issueCount: review._count.issues,
    createdAt: review.createdAt.toISOString(),
    completedAt: review.completedAt?.toISOString() ?? null,
  };
}

export function toReviewDetailDto(review: Review & { repository: Repository }): ReviewDetailDto {
  return {
    id: review.id,
    repositoryId: review.repositoryId,
    repositoryFullName: review.repository.fullName,
    baseBranch: review.baseBranch,
    headBranch: review.headBranch,
    baseSha: review.baseSha,
    headSha: review.headSha,
    status: review.status,
    summary: review.summary,
    score: review.score,
    architectureScore: review.architectureScore,
    securityScore: review.securityScore,
    qualityScore: review.qualityScore,
    performanceScore: review.performanceScore,
    testingScore: review.testingScore,
    model: review.model,
    inputTokens: review.inputTokens,
    outputTokens: review.outputTokens,
    estimatedCostUsd: review.estimatedCostUsd,
    errorMessage: review.errorMessage,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    completedAt: review.completedAt?.toISOString() ?? null,
  };
}

export function toReviewIssueDto(issue: ReviewIssue): ReviewIssueDto {
  return {
    id: issue.id,
    severity: issue.severity,
    category: issue.category,
    file: issue.file,
    line: issue.line,
    title: issue.title,
    message: issue.message,
    reason: issue.reason,
    suggestion: issue.suggestion,
  };
}

export function toReviewFileDto(file: ReviewFile): ReviewFileDto {
  return {
    id: file.id,
    filePath: file.filePath,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch,
  };
}
