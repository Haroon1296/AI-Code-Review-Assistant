import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  review: {
    create: vi.fn(),
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

const { createReview } = await import('./reviews.service.js');
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

beforeEach(() => {
  vi.clearAllMocks();
  requireConnectedRepositoryMock.mockResolvedValue(repository);
  prismaMock.review.create.mockImplementation(async ({ data }: { data: unknown }) => data);
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
