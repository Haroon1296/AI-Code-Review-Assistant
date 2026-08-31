import { Octokit } from '@octokit/rest';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors.js';
import { logger } from '../../common/logger.js';
import type {
  GithubAuthenticatedUserResponse,
  GithubOAuthTokenResponse,
} from '../auth/auth.types.js';
import type {
  GithubBranch,
  GithubCommit,
  GithubCompareResult,
  GithubRepo,
  GithubTree,
} from './github.types.js';

const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

/** Exchanges an OAuth `code` for an access token. Called once during the callback — never logs the token. */
export async function exchangeCodeForAccessToken(code: string): Promise<string> {
  const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    logger.error({ status: response.status }, 'github token exchange failed');
    throw new AppError(502, 'Failed to authenticate with GitHub', 'GITHUB_OAUTH_FAILED');
  }

  const data = (await response.json()) as GithubOAuthTokenResponse & { error?: string };
  if (data.error || !data.access_token) {
    logger.error({ error: data.error }, 'github token exchange returned an error');
    throw new AppError(502, 'Failed to authenticate with GitHub', 'GITHUB_OAUTH_FAILED');
  }

  return data.access_token;
}

/**
 * Thin, typed wrapper around Octokit. All GitHub REST access in the app goes
 * through this service — no other module should import Octokit directly.
 */
export class GithubService {
  private readonly octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({ auth: accessToken });
  }

  async getAuthenticatedUser(): Promise<GithubAuthenticatedUserResponse> {
    const { data } = await this.octokit.rest.users.getAuthenticated();
    return {
      id: data.id,
      login: data.login,
      name: data.name ?? null,
      avatar_url: data.avatar_url ?? null,
      email: data.email ?? null,
    };
  }

  async listUserRepos(page = 1, perPage = 100): Promise<GithubRepo[]> {
    const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
      page,
      per_page: perPage,
      sort: 'updated',
      affiliation: 'owner,collaborator,organization_member',
    });

    return data.map((repo) => ({
      githubRepoId: repo.id,
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      private: repo.private,
    }));
  }

  async listBranches(owner: string, repo: string): Promise<GithubBranch[]> {
    const branches = await this.octokit.paginate(this.octokit.rest.repos.listBranches, {
      owner,
      repo,
      per_page: 100,
    });

    return branches.map((branch) => ({
      name: branch.name,
      commitSha: branch.commit.sha,
      protected: branch.protected,
    }));
  }

  async getBranchHeadSha(owner: string, repo: string, branch: string): Promise<string> {
    const { data } = await this.octokit.rest.repos.getBranch({ owner, repo, branch });
    return data.commit.sha;
  }

  /** Recursive tree fetch in a single call. GitHub truncates trees over ~100k entries/7MB — callers must check `truncated`. */
  async getTree(owner: string, repo: string, sha: string): Promise<GithubTree> {
    const { data } = await this.octokit.rest.git.getTree({ owner, repo, tree_sha: sha, recursive: '1' });
    return {
      truncated: data.truncated,
      entries: data.tree
        .filter((entry): entry is typeof entry & { path: string; sha: string; type: 'blob' | 'tree' } =>
          Boolean(entry.path && entry.sha && (entry.type === 'blob' || entry.type === 'tree')),
        )
        .map((entry) => ({ path: entry.path, type: entry.type, size: entry.size, sha: entry.sha })),
    };
  }

  async getFileContent(owner: string, repo: string, path: string, ref: string): Promise<string | null> {
    const { data } = await this.octokit.rest.repos.getContent({ owner, repo, path, ref });
    if (Array.isArray(data) || data.type !== 'file' || !data.content) return null;
    return Buffer.from(data.content, data.encoding as BufferEncoding).toString('utf8');
  }

  async listCommits(owner: string, repo: string, sha: string, perPage = 20): Promise<GithubCommit[]> {
    const { data } = await this.octokit.rest.repos.listCommits({ owner, repo, sha, per_page: perPage });
    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      authorName: commit.commit.author?.name ?? null,
      authoredAt: commit.commit.author?.date ?? null,
    }));
  }

  async compareCommits(owner: string, repo: string, base: string, head: string): Promise<GithubCompareResult> {
    const { data } = await this.octokit.rest.repos.compareCommits({ owner, repo, base, head });
    return {
      aheadBy: data.ahead_by,
      behindBy: data.behind_by,
      totalCommits: data.total_commits,
      files: (data.files ?? []).map((file) => ({
        path: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
      })),
    };
  }
}
