import { prisma } from '../db/prisma.js';
import { logger } from '../common/logger.js';
import { createGithubServiceForUser } from '../modules/auth/auth.service.js';
import { getOrBuildArchitectureSnapshot } from '../modules/analyzer/analyzer.service.js';
import { getOrCreateSettings } from '../modules/settings/settings.service.js';
import { buildReviewContext } from '../modules/context-builder/context-builder.service.js';
import { runAiReview } from '../modules/ai-review/ai-review.service.js';
import { estimateCostUsd } from '../modules/ai-review/scoring.js';
import { EMPTY_TREE_SHA } from '../modules/reviews/reviews.constants.js';
import { buildWholeBranchCompareFiles } from '../modules/reviews/whole-branch-diff.js';
import { env } from '../config/env.js';
import type { ArchitecturePattern } from '@acra/types';

/** Orchestrates one review end-to-end: analyze -> build context -> AI review -> persist. */
export async function processReview(reviewId: string): Promise<void> {
  const review = await prisma.review.findUniqueOrThrow({
    where: { id: reviewId },
    include: { repository: true },
  });

  const isWholeBranchReview = review.baseSha === EMPTY_TREE_SHA;

  try {
    await prisma.review.update({ where: { id: reviewId }, data: { status: 'analyzing' } });

    const github = await createGithubServiceForUser(review.userId);
    // A whole-branch review has no separate base branch to profile — the head
    // branch's own code is both "the existing architecture" and "the change".
    const snapshot = await getOrBuildArchitectureSnapshot(
      review.userId,
      review.repositoryId,
      isWholeBranchReview ? review.headBranch : review.baseBranch,
    );

    await prisma.review.update({
      where: { id: reviewId },
      data: { status: 'reviewing', architectureSnapshotId: snapshot.id },
    });

    const settings = await getOrCreateSettings(review.userId);

    const compare = isWholeBranchReview
      ? await buildWholeBranchCompareFiles(
          github,
          review.repository.owner,
          review.repository.name,
          review.headSha ?? review.headBranch,
          { excludedPatterns: settings.excludedPatterns, maxFiles: settings.maxFiles },
        )
      : await github.compareCommits(
          review.repository.owner,
          review.repository.name,
          review.baseBranch,
          review.headBranch,
        );

    if (compare.files.length >= 300) {
      logger.warn(
        { reviewId, fileCount: compare.files.length },
        'compare result may be truncated by GitHub API (>=300 files)',
      );
    }

    if (compare.files.length === 0) {
      await prisma.review.update({
        where: { id: reviewId },
        data: {
          status: 'completed',
          summary: isWholeBranchReview
            ? `${review.headBranch} has no files — there is nothing to review.`
            : `No differences were found between ${review.baseBranch} and ${review.headBranch} — there is nothing to review.`,
          completedAt: new Date(),
        },
      });
      logger.info({ reviewId }, 'review completed: no changed files, skipped AI call');
      return;
    }

    const bundle = await buildReviewContext({
      github,
      owner: review.repository.owner,
      repo: review.repository.name,
      // In whole-branch mode every file is already in the diff, so relevant-file
      // lookup naturally yields nothing; use the head tree rather than the
      // empty-tree SHA, which GitHub's tree API may not resolve.
      baseSha: isWholeBranchReview
        ? (review.headSha ?? review.headBranch)
        : (review.baseSha ?? review.headSha ?? review.baseBranch),
      compareFiles: compare.files,
      architecture: {
        language: snapshot.language,
        framework: snapshot.framework,
        packageManager: snapshot.packageManager,
        layering: snapshot.layering,
        patterns: snapshot.patternsJson as ArchitecturePattern[],
        conventions: snapshot.conventionsJson as {
          testingFramework: string | null;
          testingDirectories: string[];
          dominantNamingStyle: string | null;
        },
        confidence: snapshot.confidence,
      },
      settings: {
        excludedPatterns: settings.excludedPatterns,
        maxChangedFiles: settings.maxFiles,
        maxRelevantFiles: env.MAX_RELEVANT_FILES,
        maxFileSizeKb: settings.maxFileSizeKb,
        maxContextTokens: settings.maxContextTokens,
      },
    });

    const aiResult = await runAiReview(bundle, { model: settings.model });
    const estimatedCostUsd = estimateCostUsd(
      aiResult.model,
      aiResult.inputTokens,
      aiResult.outputTokens,
    );

    await prisma.$transaction([
      prisma.reviewFile.createMany({
        data: bundle.changedFiles.map((f) => ({
          reviewId,
          filePath: f.path,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch,
        })),
      }),
      prisma.reviewIssue.createMany({
        data: aiResult.output.issues.map((issue) => ({
          reviewId,
          severity: issue.severity,
          category: issue.category,
          file: issue.file,
          line: issue.line,
          title: issue.title,
          message: issue.message,
          reason: issue.reason,
          suggestion: issue.suggestion,
        })),
      }),
      prisma.review.update({
        where: { id: reviewId },
        data: {
          status: 'completed',
          summary: aiResult.output.summary,
          score: aiResult.output.score,
          architectureScore: aiResult.output.architecture_score,
          securityScore: aiResult.output.security_score,
          qualityScore: aiResult.output.quality_score,
          performanceScore: aiResult.output.performance_score,
          testingScore: aiResult.output.testing_score,
          model: aiResult.model,
          inputTokens: aiResult.inputTokens,
          outputTokens: aiResult.outputTokens,
          estimatedCostUsd,
          completedAt: new Date(),
        },
      }),
    ]);

    logger.info({ reviewId, score: aiResult.output.score }, 'review completed');
  } catch (err) {
    logger.error({ reviewId, err }, 'review failed');
    await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Unknown error during review',
      },
    });
  }
}
