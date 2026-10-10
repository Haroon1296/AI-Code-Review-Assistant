import { beforeEach, describe, expect, it, vi } from 'vitest';

const octokitMock = {
  rest: {
    pulls: { list: vi.fn() },
    issues: { createComment: vi.fn(), updateComment: vi.fn() },
    repos: { createCommitComment: vi.fn(), updateCommitComment: vi.fn() },
  },
};

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => octokitMock),
}));

const { GithubService } = await import('./github.service.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GithubService comment methods', () => {
  const github = new GithubService('token');

  it('findOpenPullRequestForBranch returns the first open PR for the branch', async () => {
    octokitMock.rest.pulls.list.mockResolvedValue({ data: [{ number: 42 }] });

    const pr = await github.findOpenPullRequestForBranch('acme', 'widgets', 'feature/x');

    expect(pr).toEqual({ number: 42 });
    expect(octokitMock.rest.pulls.list).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      state: 'open',
      head: 'acme:feature/x',
      per_page: 1,
    });
  });

  it('findOpenPullRequestForBranch returns null when there is no open PR', async () => {
    octokitMock.rest.pulls.list.mockResolvedValue({ data: [] });

    const pr = await github.findOpenPullRequestForBranch('acme', 'widgets', 'main');

    expect(pr).toBeNull();
  });

  it('createIssueComment posts to the PR/issue comments endpoint', async () => {
    octokitMock.rest.issues.createComment.mockResolvedValue({
      data: { id: 1, html_url: 'https://gh/comment/1' },
    });

    const comment = await github.createIssueComment('acme', 'widgets', 42, 'body');

    expect(comment).toEqual({ id: 1, url: 'https://gh/comment/1' });
    expect(octokitMock.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      issue_number: 42,
      body: 'body',
    });
  });

  it('updateIssueComment edits an existing PR/issue comment', async () => {
    octokitMock.rest.issues.updateComment.mockResolvedValue({
      data: { id: 1, html_url: 'https://gh/comment/1' },
    });

    const comment = await github.updateIssueComment('acme', 'widgets', 1, 'new body');

    expect(comment).toEqual({ id: 1, url: 'https://gh/comment/1' });
    expect(octokitMock.rest.issues.updateComment).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      comment_id: 1,
      body: 'new body',
    });
  });

  it('createCommitComment posts to the commit comments endpoint', async () => {
    octokitMock.rest.repos.createCommitComment.mockResolvedValue({
      data: { id: 2, html_url: 'https://gh/commit-comment/2' },
    });

    const comment = await github.createCommitComment('acme', 'widgets', 'sha-1', 'body');

    expect(comment).toEqual({ id: 2, url: 'https://gh/commit-comment/2' });
    expect(octokitMock.rest.repos.createCommitComment).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      commit_sha: 'sha-1',
      body: 'body',
    });
  });

  it('updateCommitComment edits an existing commit comment', async () => {
    octokitMock.rest.repos.updateCommitComment.mockResolvedValue({
      data: { id: 2, html_url: 'https://gh/commit-comment/2' },
    });

    const comment = await github.updateCommitComment('acme', 'widgets', 2, 'new body');

    expect(comment).toEqual({ id: 2, url: 'https://gh/commit-comment/2' });
    expect(octokitMock.rest.repos.updateCommitComment).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      comment_id: 2,
      body: 'new body',
    });
  });
});
