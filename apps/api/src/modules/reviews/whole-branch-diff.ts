import { isExcludedPath } from '@acra/shared';
import type { GithubService } from '../github/github.service.js';
import type { GithubCompareFile, GithubCompareResult } from '../github/github.types.js';

const MAX_FILE_LINES = 300;

function buildAddedFilePatch(content: string): { patch: string; lineCount: number } {
  const allLines = content.split('\n');
  const lines = allLines.length > MAX_FILE_LINES ? allLines.slice(0, MAX_FILE_LINES) : allLines;
  const patch = `@@ -0,0 +1,${lines.length} @@\n${lines.map((line) => `+${line}`).join('\n')}`;
  return { patch, lineCount: lines.length };
}

/**
 * Synthesizes a compare-style result for reviewing an entire branch with no
 * base branch: every eligible file is treated as "added", built from the
 * branch's tree and file contents. GitHub's compare API does not reliably
 * resolve the git empty-tree SHA as a `base` for arbitrary repos (404s), so
 * this avoids that endpoint entirely rather than diffing against it.
 */
export async function buildWholeBranchCompareFiles(
  github: GithubService,
  owner: string,
  repo: string,
  headSha: string,
  settings: { excludedPatterns: string[]; maxFiles: number },
): Promise<GithubCompareResult> {
  const tree = await github.getTree(owner, repo, headSha);
  const eligible = tree.entries
    .filter(
      (entry) => entry.type === 'blob' && !isExcludedPath(entry.path, settings.excludedPatterns),
    )
    .slice(0, settings.maxFiles);

  const files: GithubCompareFile[] = [];
  for (const entry of eligible) {
    const content = await github.getFileContent(owner, repo, entry.path, headSha).catch(() => null);
    if (content === null) continue;
    const { patch, lineCount } = buildAddedFilePatch(content);
    files.push({ path: entry.path, status: 'added', additions: lineCount, deletions: 0, patch });
  }

  return { aheadBy: files.length, behindBy: 0, totalCommits: 0, files };
}
