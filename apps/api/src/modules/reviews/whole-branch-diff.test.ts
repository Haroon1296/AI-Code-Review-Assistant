import { describe, expect, it, vi } from 'vitest';
import { buildWholeBranchCompareFiles } from './whole-branch-diff.js';

function fakeGithub(
  files: Record<string, string>,
  treeOverride?: Array<{ path: string; type: 'blob' | 'tree' }>,
) {
  const entries =
    treeOverride ?? Object.keys(files).map((path) => ({ path, type: 'blob' as const }));
  return {
    getTree: vi.fn(async () => ({
      truncated: false,
      entries: entries.map((e) => ({ ...e, sha: 'x' })),
    })),
    getFileContent: vi.fn(
      async (_owner: string, _repo: string, path: string) => files[path] ?? null,
    ),
  } as never;
}

describe('buildWholeBranchCompareFiles', () => {
  it('treats every eligible file as added, with a synthetic unified-diff patch', async () => {
    const github = fakeGithub({ 'src/a.ts': 'line1\nline2', 'src/b.ts': 'x' });

    const result = await buildWholeBranchCompareFiles(github, 'acme', 'widgets', 'sha-head', {
      excludedPatterns: [],
      maxFiles: 40,
    });

    expect(result.files).toHaveLength(2);
    const a = result.files.find((f) => f.path === 'src/a.ts')!;
    expect(a.status).toBe('added');
    expect(a.additions).toBe(2);
    expect(a.deletions).toBe(0);
    expect(a.patch).toBe('@@ -0,0 +1,2 @@\n+line1\n+line2');
  });

  it('excludes paths matching the excluded patterns', async () => {
    const github = fakeGithub({ 'src/a.ts': 'x', 'node_modules/dep/index.js': 'y' });

    const result = await buildWholeBranchCompareFiles(github, 'acme', 'widgets', 'sha-head', {
      excludedPatterns: ['node_modules/**'],
      maxFiles: 40,
    });

    expect(result.files.map((f) => f.path)).toEqual(['src/a.ts']);
  });

  it('caps the number of files at maxFiles', async () => {
    const github = fakeGithub({ 'a.ts': 'x', 'b.ts': 'y', 'c.ts': 'z' });

    const result = await buildWholeBranchCompareFiles(github, 'acme', 'widgets', 'sha-head', {
      excludedPatterns: [],
      maxFiles: 2,
    });

    expect(result.files).toHaveLength(2);
  });

  it('ignores tree entries and files whose content cannot be fetched', async () => {
    const github = fakeGithub({ 'src/a.ts': 'x' }, [
      { path: 'src/a.ts', type: 'blob' },
      { path: 'src', type: 'tree' },
      { path: 'binary.png', type: 'blob' },
    ]);

    const result = await buildWholeBranchCompareFiles(github, 'acme', 'widgets', 'sha-head', {
      excludedPatterns: [],
      maxFiles: 40,
    });

    expect(result.files.map((f) => f.path)).toEqual(['src/a.ts']);
  });

  it('truncates very large files to the first 300 lines', async () => {
    const bigContent = Array.from({ length: 500 }, (_, i) => `line${i}`).join('\n');
    const github = fakeGithub({ 'big.ts': bigContent });

    const result = await buildWholeBranchCompareFiles(github, 'acme', 'widgets', 'sha-head', {
      excludedPatterns: [],
      maxFiles: 40,
    });

    const file = result.files[0]!;
    expect(file.additions).toBe(300);
    expect(file.patch?.split('\n')).toHaveLength(301); // hunk header + 300 lines
  });
});
