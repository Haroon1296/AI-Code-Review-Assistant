export interface GithubRepo {
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

export interface GithubBranch {
  name: string;
  commitSha: string;
  protected: boolean;
}

export interface GithubTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  sha: string;
}

export interface GithubTree {
  truncated: boolean;
  entries: GithubTreeEntry[];
}

export interface GithubCompareFile {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'changed' | 'copied' | 'unchanged';
  additions: number;
  deletions: number;
  patch?: string;
}

export interface GithubCompareResult {
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  files: GithubCompareFile[];
}

export interface GithubCommit {
  sha: string;
  message: string;
  authorName: string | null;
  authoredAt: string | null;
}
