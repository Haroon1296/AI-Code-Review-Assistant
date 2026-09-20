import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  review: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  reviewFile: { createMany: vi.fn() },
  reviewIssue: { createMany: vi.fn() },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};

const createGithubServiceForUserMock = vi.fn();
const getOrBuildArchitectureSnapshotMock = vi.fn();
const getOrCreateSettingsMock = vi.fn();
const buildReviewContextMock = vi.fn();
const runAiReviewMock = vi.fn();
const buildWholeBranchCompareFilesMock = vi.fn();

vi.mock('../db/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../modules/auth/auth.service.js', () => ({
  createGithubServiceForUser: createGithubServiceForUserMock,
}));
vi.mock('../modules/analyzer/analyzer.service.js', () => ({
  getOrBuildArchitectureSnapshot: getOrBuildArchitectureSnapshotMock,
}));
vi.mock('../modules/settings/settings.service.js', () => ({
  getOrCreateSettings: getOrCreateSettingsMock,
}));
vi.mock('../modules/context-builder/context-builder.service.js', () => ({
  buildReviewContext: buildReviewContextMock,
}));
vi.mock('../modules/ai-review/ai-review.service.js', () => ({
  runAiReview: runAiReviewMock,
}));
vi.mock('../modules/reviews/whole-branch-diff.js', () => ({
  buildWholeBranchCompareFiles: buildWholeBranchCompareFilesMock,
}));

const { processReview } = await import('./review.processor.js');
const { EMPTY_TREE_SHA, WHOLE_BRANCH_BASE_LABEL } =
  await import('../modules/reviews/reviews.constants.js');

const baseReview = {
  id: 'review-1',
  userId: 'user-1',
  repositoryId: 'repo-1',
  baseBranch: 'main',
  headBranch: 'feature/x',
  baseSha: 'sha-base',
  headSha: 'sha-head',
  repository: { owner: 'acme', name: 'widgets' },
};

function fakeGithubService(
  compareFiles: Array<{
    path: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string | null;
  }>,
) {
  return {
    compareCommits: vi.fn(async () => ({
      aheadBy: 1,
      behindBy: 0,
      totalCommits: 1,
      files: compareFiles,
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.review.findUniqueOrThrow.mockResolvedValue(baseReview);
  prismaMock.review.update.mockResolvedValue(baseReview);
  prismaMock.reviewFile.createMany.mockResolvedValue({ count: 0 });
  prismaMock.reviewIssue.createMany.mockResolvedValue({ count: 0 });
  getOrBuildArchitectureSnapshotMock.mockResolvedValue({
    id: 'snapshot-1',
    language: 'TypeScript',
    framework: null,
    packageManager: 'npm',
    layering: [],
    patternsJson: [],
    conventionsJson: { testingFramework: null, testingDirectories: [], dominantNamingStyle: null },
    confidence: 'low',
  });
  getOrCreateSettingsMock.mockResolvedValue({
    excludedPatterns: [],
    maxFiles: 40,
    maxFileSizeKb: 64,
    maxContextTokens: 12000,
    model: 'gpt-4.1-mini',
  });
});

describe('processReview', () => {
  it('completes without calling the AI when there is no diff', async () => {
    createGithubServiceForUserMock.mockResolvedValue(fakeGithubService([]));

    await processReview('review-1');

    expect(runAiReviewMock).not.toHaveBeenCalled();
    expect(prismaMock.review.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'review-1' },
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });

  it('runs the AI review and persists files/issues/scores on the happy path', async () => {
    createGithubServiceForUserMock.mockResolvedValue(
      fakeGithubService([
        { path: 'src/a.ts', status: 'modified', additions: 1, deletions: 0, patch: '+x' },
      ]),
    );
    buildReviewContextMock.mockResolvedValue({
      changedFiles: [
        { path: 'src/a.ts', status: 'modified', additions: 1, deletions: 0, patch: '+x' },
      ],
      limits: { changedFilesOmitted: 0, relevantFilesOmitted: 0, estimatedTokens: 10 },
    });
    runAiReviewMock.mockResolvedValue({
      output: {
        summary: 'Looks fine',
        score: 90,
        architecture_score: 90,
        security_score: 90,
        quality_score: 90,
        performance_score: 90,
        testing_score: 90,
        issues: [
          {
            severity: 'low',
            category: 'quality',
            file: 'src/a.ts',
            line: 1,
            title: 'Nit',
            message: 'minor',
            reason: 'style',
            suggestion: 'rename',
          },
        ],
      },
      model: 'gpt-4.1-mini',
      inputTokens: 100,
      outputTokens: 50,
    });

    await processReview('review-1');

    expect(prismaMock.reviewFile.createMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.reviewIssue.createMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.review.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'review-1' },
        data: expect.objectContaining({ status: 'completed', score: 90 }),
      }),
    );
  });

  it('marks the review failed when the AI call throws, without partially persisting results', async () => {
    createGithubServiceForUserMock.mockResolvedValue(
      fakeGithubService([
        { path: 'src/a.ts', status: 'modified', additions: 1, deletions: 0, patch: '+x' },
      ]),
    );
    buildReviewContextMock.mockResolvedValue({
      changedFiles: [
        { path: 'src/a.ts', status: 'modified', additions: 1, deletions: 0, patch: '+x' },
      ],
      limits: { changedFilesOmitted: 0, relevantFilesOmitted: 0, estimatedTokens: 10 },
    });
    runAiReviewMock.mockRejectedValue(new Error('OpenAI is down'));

    await processReview('review-1');

    expect(prismaMock.reviewFile.createMany).not.toHaveBeenCalled();
    expect(prismaMock.reviewIssue.createMany).not.toHaveBeenCalled();
    expect(prismaMock.review.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'review-1' },
        data: expect.objectContaining({ status: 'failed', errorMessage: 'OpenAI is down' }),
      }),
    );
  });

  it('builds the diff from the branch tree (not compareCommits) and profiles the head branch for a whole-branch review', async () => {
    const wholeBranchReview = {
      ...baseReview,
      baseBranch: WHOLE_BRANCH_BASE_LABEL,
      baseSha: EMPTY_TREE_SHA,
    };
    prismaMock.review.findUniqueOrThrow.mockResolvedValue(wholeBranchReview);
    prismaMock.review.update.mockResolvedValue(wholeBranchReview);

    const github = fakeGithubService([]);
    createGithubServiceForUserMock.mockResolvedValue(github);
    buildWholeBranchCompareFilesMock.mockResolvedValue({
      aheadBy: 1,
      behindBy: 0,
      totalCommits: 0,
      files: [
        { path: 'src/a.ts', status: 'added', additions: 10, deletions: 0, patch: '+everything' },
      ],
    });
    buildReviewContextMock.mockResolvedValue({
      changedFiles: [
        { path: 'src/a.ts', status: 'added', additions: 10, deletions: 0, patch: '+everything' },
      ],
      limits: { changedFilesOmitted: 0, relevantFilesOmitted: 0, estimatedTokens: 10 },
    });
    runAiReviewMock.mockResolvedValue({
      output: {
        summary: 'Whole branch looks fine',
        score: 80,
        architecture_score: 80,
        security_score: 80,
        quality_score: 80,
        performance_score: 80,
        testing_score: 80,
        issues: [],
      },
      model: 'gpt-4.1-mini',
      inputTokens: 100,
      outputTokens: 50,
    });

    await processReview('review-1');

    // Profiled off the head branch, not the (nonexistent) base branch.
    expect(getOrBuildArchitectureSnapshotMock).toHaveBeenCalledWith(
      'user-1',
      'repo-1',
      'feature/x',
    );
    // Built from the branch tree, not GitHub's compare API (which 404s on the empty-tree SHA).
    expect(github.compareCommits).not.toHaveBeenCalled();
    expect(buildWholeBranchCompareFilesMock).toHaveBeenCalledWith(
      github,
      'acme',
      'widgets',
      'sha-head',
      expect.objectContaining({ excludedPatterns: [], maxFiles: 40 }),
    );
    expect(prismaMock.review.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'review-1' },
        data: expect.objectContaining({ status: 'completed', score: 80 }),
      }),
    );
  });
});
