import type { Repository } from '@prisma/client';
import type { ConnectRepositoryRequest, RepositoryListItem } from '@acra/types';
import { prisma } from '../../db/prisma.js';
import { notFound } from '../../common/errors.js';
import { createGithubServiceForUser } from '../auth/auth.service.js';
import type { GithubBranch } from '../github/github.types.js';
import type { CompareSummary } from '@acra/types';

export async function listRepositoriesForUser(userId: string): Promise<RepositoryListItem[]> {
  const github = await createGithubServiceForUser(userId);
  const [remoteRepos, connections] = await Promise.all([
    github.listUserRepos(),
    prisma.repositoryConnection.findMany({
      where: { userId },
      include: { repository: true },
    }),
  ]);

  const connectedByGithubId = new Map(connections.map((c) => [c.repository.githubRepoId, c.repository]));

  return remoteRepos.map((repo) => {
    const connected = connectedByGithubId.get(repo.githubRepoId);
    return {
      githubRepoId: repo.githubRepoId,
      owner: repo.owner,
      name: repo.name,
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      private: repo.private,
      isConnected: Boolean(connected),
      internalId: connected?.id ?? null,
    };
  });
}

/** Idempotently connects a GitHub repo to the current user (upsert repo metadata + join row). */
export async function connectRepository(
  userId: string,
  input: ConnectRepositoryRequest,
): Promise<Repository> {
  const repository = await prisma.repository.upsert({
    where: { githubRepoId: input.githubRepoId },
    update: {
      owner: input.owner,
      name: input.name,
      fullName: input.fullName,
      defaultBranch: input.defaultBranch,
      private: input.private,
    },
    create: {
      githubRepoId: input.githubRepoId,
      owner: input.owner,
      name: input.name,
      fullName: input.fullName,
      defaultBranch: input.defaultBranch,
      private: input.private,
    },
  });

  await prisma.repositoryConnection.upsert({
    where: { userId_repositoryId: { userId, repositoryId: repository.id } },
    update: {},
    create: { userId, repositoryId: repository.id },
  });

  return repository;
}

/** Authorization check: throws 404 (not 403, to avoid confirming existence) if the user hasn't connected this repo. */
export async function requireConnectedRepository(userId: string, repositoryId: string): Promise<Repository> {
  const connection = await prisma.repositoryConnection.findUnique({
    where: { userId_repositoryId: { userId, repositoryId } },
    include: { repository: true },
  });
  if (!connection) throw notFound('Repository not found');
  return connection.repository;
}

export async function listBranchesForRepository(userId: string, repositoryId: string): Promise<GithubBranch[]> {
  const repository = await requireConnectedRepository(userId, repositoryId);
  const github = await createGithubServiceForUser(userId);
  return github.listBranches(repository.owner, repository.name);
}

export async function compareRepositoryBranches(
  userId: string,
  repositoryId: string,
  base: string,
  head: string,
): Promise<CompareSummary> {
  const repository = await requireConnectedRepository(userId, repositoryId);
  const github = await createGithubServiceForUser(userId);
  const result = await github.compareCommits(repository.owner, repository.name, base, head);

  return {
    aheadBy: result.aheadBy,
    behindBy: result.behindBy,
    totalCommits: result.totalCommits,
    files: result.files.map((f) => ({
      path: f.path,
      status: f.status === 'changed' || f.status === 'copied' || f.status === 'unchanged' ? 'modified' : f.status,
      additions: f.additions,
      deletions: f.deletions,
    })),
  };
}
