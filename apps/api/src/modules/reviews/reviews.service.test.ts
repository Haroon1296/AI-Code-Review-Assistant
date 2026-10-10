import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  review: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  reviewIssue: {
    findMany: vi.fn(),
  },
};
const requireConnectedRepositoryMock = vi.fn();
const createGithubServiceForUserMock = vi.fn();
const enqueueReviewMock = vi.fn();

vi.mock('../../db/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../auth/auth.service.js', () => ({
  createGithubServiceForUser: createGithubServiceForUserMock,
}));
vi.mock('../repositories/repositories.service.js', () => ({
  requireConnectedRepository: requireConnectedRepositoryMock,
}));
vi.mock('../../queue/queue.js', () => ({ enqueueReview: enqueueReviewMock }));

const { createReview, postReviewComment } = await import('./reviews.service.js');
const { EMPTY_TREE_SHA, WHOLE_BRANCH_BASE_LABEL } = await import('./reviews.constants.js');

const repository = {
  id: 'repo-1',
  owner: 'acme',
  name: 'widgets',
  defaultBranch: 'main',
};

function fakeGithubService(shaByBranch: Record<string, string>) {
  return {
    getBranchHeadSha: vi.fn(async (_owner: string, _repo: string, branch: string) => {
      const sha = shaByBranch[branch];
      if (!sha) throw new Error('branch not found');
      return sha;
    }),
  };
}

function fakeCommentingGithubService(openPr: { number: number } | null = null) {
  return {
    findOpenPullRequestForBranch: vi.fn(async () => openPr),
    createIssueComment: vi.fn(async () => ({
      id: 101,
      url: 'https://github.com/acme/widgets/pull/1#comment-101',
    })),
    updateIssueComment: vi.fn(async () => ({
      id: 101,
      url: 'https://github.com/acme/widgets/pull/1#comment-101',
    })),
    createCommitComment: vi.fn(async () => ({
      id: 202,
      url: 'https://github.com/acme/widgets/commit/sha#comment-202',
    })),
    updateCommitComment: vi.fn(async () => ({
      id: 202,
      url: 'https://github.com/acme/widgets/commit/sha#comment-202',
    })),
  };
}

const completedReview = {
  id: 'review-1',
  userId: 'user-1',
  status: 'completed',
  headBranch: 'feature/x',
  headSha: 'sha-head',
  githubCommentId: null as number | null,
  githubCommentTarget: null as 'pull_request' | 'commit' | null,
  githubCommentPrNumber: null as number | null,
  summary: 'All good',
  score: 90,
  architectureScore: 90,
  securityScore: 90,
  qualityScore: 90,
  performanceScore: 90,
  testingScore: 90,
  repository: { id: 'repo-1', owner: 'acme', name: 'widgets' },
};

beforeEach(() => {
  vi.clearAllMocks();
  requireConnectedRepositoryMock.mockResolvedValue(repository);
  prismaMock.review.create.mockImplementation(async ({ data }: { data: unknown }) => data);
  prismaMock.review.findUnique.mockResolvedValue(completedReview);
  prismaMock.review.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...completedReview,
      ...data,
    }),
  );
  prismaMock.reviewIssue.findMany.mockResolvedValue([]);
});

describe('createReview', () => {
  it('defaults baseBranch to the repository default branch when omitted', async () => {
    createGithubServiceForUserMock.mockResolvedValue(
      fakeGithubService({ main: 'sha-main', 'feature/x': 'sha-feature' }),
    );

    const review = await createReview('user-1', {
      repositoryId: 'repo-1',
      headBranch: 'feature/x',
    });

    expect(review).toMatchObject({ baseBranch: 'main', headBranch: 'feature/x' });
    expect(enqueueReviewMock).toHaveBeenCalledTimes(1);
  });

  it('throws SAME_BRANCH when headBranch equals the defaulted baseBranch', async () => {
    createGithubServiceForUserMock.mockResolvedValue(fakeGithubService({ main: 'sha-main' }));

    await expect(
      createReview('user-1', { repositoryId: 'repo-1', headBranch: 'main' }),
    ).rejects.toMatchObject({ code: 'SAME_BRANCH' });
    expect(enqueueReviewMock).not.toHaveBeenCalled();
  });

  it('still honors an explicit baseBranch', async () => {
    createGithubServiceForUserMock.mockResolvedValue(
      fakeGithubService({ develop: 'sha-develop', 'feature/x': 'sha-feature' }),
    );

    const review = await createReview('user-1', {
      repositoryId: 'repo-1',
      baseBranch: 'develop',
      headBranch: 'feature/x',
    });

    expect(review).toMatchObject({ baseBranch: 'develop', headBranch: 'feature/x' });
  });

  it('throws BRANCH_NOT_FOUND when either branch is missing on GitHub', async () => {
    createGithubServiceForUserMock.mockResolvedValue(fakeGithubService({ main: 'sha-main' }));

    await expect(
      createReview('user-1', { repositoryId: 'repo-1', headBranch: 'does-not-exist' }),
    ).rejects.toMatchObject({ code: 'BRANCH_NOT_FOUND' });
    expect(enqueueReviewMock).not.toHaveBeenCalled();
  });

  it('propagates the ownership/connection check for repos the user cannot access', async () => {
    requireConnectedRepositoryMock.mockRejectedValue(new Error('not found'));

    await expect(
      createReview('user-1', { repositoryId: 'repo-1', headBranch: 'feature/x' }),
    ).rejects.toThrow('not found');
    expect(createGithubServiceForUserMock).not.toHaveBeenCalled();
  });

  it('reviews the whole branch against the empty tree when wholeBranch is set, even if the repo has only one branch', async () => {
    createGithubServiceForUserMock.mockResolvedValue(fakeGithubService({ main: 'sha-main' }));

    const review = await createReview('user-1', {
      repositoryId: 'repo-1',
      headBranch: 'main',
      wholeBranch: true,
    });

    expect(review).toMatchObject({
      baseBranch: WHOLE_BRANCH_BASE_LABEL,
      headBranch: 'main',
      baseSha: EMPTY_TREE_SHA,
      headSha: 'sha-main',
    });
    expect(enqueueReviewMock).toHaveBeenCalledTimes(1);
  });

  it('throws BRANCH_NOT_FOUND for a whole-branch review of a branch that does not exist', async () => {
    createGithubServiceForUserMock.mockResolvedValue(fakeGithubService({ main: 'sha-main' }));

    await expect(
      createReview('user-1', { repositoryId: 'repo-1', headBranch: 'ghost', wholeBranch: true }),
    ).rejects.toMatchObject({ code: 'BRANCH_NOT_FOUND' });
    expect(enqueueReviewMock).not.toHaveBeenCalled();
  });
});

describe('postReviewComment', () => {
  it('posts a PR comment when the head branch has an open pull request', async () => {
    const github = fakeCommentingGithubService({ number: 7 });
    createGithubServiceForUserMock.mockResolvedValue(github);

    const review = await postReviewComment('user-1', 'review-1');

    expect(github.findOpenPullRequestForBranch).toHaveBeenCalledWith(
      'acme',
      'widgets',
      'feature/x',
    );
    expect(github.createIssueComment).toHaveBeenCalledWith(
      'acme',
      'widgets',
      7,
      expect.any(String),
    );
    expect(github.createCommitComment).not.toHaveBeenCalled();
    expect(review).toMatchObject({
      githubCommentId: 101,
      githubCommentTarget: 'pull_request',
      githubCommentUrl: 'https://github.com/acme/widgets/pull/1#comment-101',
    });
  });

  it('falls back to a commit comment when there is no open pull request', async () => {
    const github = fakeCommentingGithubService(null);
    createGithubServiceForUserMock.mockResolvedValue(github);

    const review = await postReviewComment('user-1', 'review-1');

    expect(github.createCommitComment).toHaveBeenCalledWith(
      'acme',
      'widgets',
      'sha-head',
      expect.any(String),
    );
    expect(github.createIssueComment).not.toHaveBeenCalled();
    expect(review).toMatchObject({ githubCommentId: 202, githubCommentTarget: 'commit' });
  });

  it('updates the existing comment on repeat posts to the same pull request', async () => {
    prismaMock.review.findUnique.mockResolvedValue({
      ...completedReview,
      githubCommentId: 101,
      githubCommentTarget: 'pull_request',
      githubCommentPrNumber: 7,
    });
    const github = fakeCommentingGithubService({ number: 7 });
    createGithubServiceForUserMock.mockResolvedValue(github);

    await postReviewComment('user-1', 'review-1');

    expect(github.updateIssueComment).toHaveBeenCalledWith(
      'acme',
      'widgets',
      101,
      expect.any(String),
    );
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });

  it('comments on the newly-opened pull request instead of editing the comment left on a since-closed one', async () => {
    prismaMock.review.findUnique.mockResolvedValue({
      ...completedReview,
      githubCommentId: 101,
      githubCommentTarget: 'pull_request',
      githubCommentPrNumber: 7, // the PR that comment lives on, since closed
    });
    const github = fakeCommentingGithubService({ number: 9 }); // a different PR is open now
    createGithubServiceForUserMock.mockResolvedValue(github);

    const review = await postReviewComment('user-1', 'review-1');

    expect(github.createIssueComment).toHaveBeenCalledWith(
      'acme',
      'widgets',
      9,
      expect.any(String),
    );
    expect(github.updateIssueComment).not.toHaveBeenCalled();
    expect(review).toMatchObject({ githubCommentPrNumber: 9 });
  });

  it('creates a new comment (does not try to update) when the target type changed since the last post', async () => {
    prismaMock.review.findUnique.mockResolvedValue({
      ...completedReview,
      githubCommentId: 202,
      githubCommentTarget: 'commit',
    });
    const github = fakeCommentingGithubService({ number: 7 }); // a PR opened since the last post
    createGithubServiceForUserMock.mockResolvedValue(github);

    await postReviewComment('user-1', 'review-1');

    expect(github.createIssueComment).toHaveBeenCalledWith(
      'acme',
      'widgets',
      7,
      expect.any(String),
    );
    expect(github.updateIssueComment).not.toHaveBeenCalled();
  });

  it('falls back to creating a new comment when the stored comment was deleted upstream (404 on update)', async () => {
    prismaMock.review.findUnique.mockResolvedValue({
      ...completedReview,
      githubCommentId: 202,
      githubCommentTarget: 'commit',
    });
    const github = fakeCommentingGithubService(null);
    github.updateCommitComment.mockRejectedValue({ status: 404 });
    createGithubServiceForUserMock.mockResolvedValue(github);

    const review = await postReviewComment('user-1', 'review-1');

    expect(github.updateCommitComment).toHaveBeenCalled();
    expect(github.createCommitComment).toHaveBeenCalled();
    expect(review).toMatchObject({ githubCommentId: 202 });
  });

  it('throws REVIEW_NOT_COMPLETED when the review has not finished', async () => {
    prismaMock.review.findUnique.mockResolvedValue({ ...completedReview, status: 'reviewing' });

    await expect(postReviewComment('user-1', 'review-1')).rejects.toMatchObject({
      code: 'REVIEW_NOT_COMPLETED',
    });
    expect(createGithubServiceForUserMock).not.toHaveBeenCalled();
  });

  it('throws MISSING_HEAD_SHA when the review has no headSha', async () => {
    prismaMock.review.findUnique.mockResolvedValue({ ...completedReview, headSha: null });

    await expect(postReviewComment('user-1', 'review-1')).rejects.toMatchObject({
      code: 'MISSING_HEAD_SHA',
    });
  });

  it('throws not found for a review the user does not own', async () => {
    prismaMock.review.findUnique.mockResolvedValue({ ...completedReview, userId: 'someone-else' });

    await expect(postReviewComment('user-1', 'review-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('maps a GitHub failure to the app error convention', async () => {
    const github = fakeCommentingGithubService(null);
    github.createCommitComment.mockRejectedValue({ status: 401 });
    createGithubServiceForUserMock.mockResolvedValue(github);

    await expect(postReviewComment('user-1', 'review-1')).rejects.toMatchObject({
      code: 'GITHUB_TOKEN_INVALID',
    });
  });

  it('maps a failure of the pull-request lookup itself, not just the comment call', async () => {
    const github = fakeCommentingGithubService(null);
    github.findOpenPullRequestForBranch.mockRejectedValue({ status: 401 });
    createGithubServiceForUserMock.mockResolvedValue(github);

    await expect(postReviewComment('user-1', 'review-1')).rejects.toMatchObject({
      code: 'GITHUB_TOKEN_INVALID',
    });
  });

  it('does not disguise a failure to persist as a GitHub failure once the comment is live', async () => {
    const github = fakeCommentingGithubService(null);
    createGithubServiceForUserMock.mockResolvedValue(github);
    prismaMock.review.update.mockRejectedValue(new Error('connection terminated'));

    await expect(postReviewComment('user-1', 'review-1')).rejects.toThrow('connection terminated');
    expect(github.createCommitComment).toHaveBeenCalled();
  });
});
