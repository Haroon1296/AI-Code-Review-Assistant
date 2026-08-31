import { describe, expect, it } from 'vitest';
import { analyzeRepository } from './analyzer.service.js';
import type { RepoContentSource } from './analyzer.types.js';

function fakeGithub(files: Record<string, string>): RepoContentSource {
  return {
    async getTree() {
      return {
        truncated: false,
        entries: Object.keys(files).map((path) => ({ path, type: 'blob' as const, sha: 'x' })),
      };
    },
    async getFileContent(_owner, _repo, path) {
      return files[path] ?? null;
    },
  };
}

describe('analyzeRepository', () => {
  it('detects a Node/Express repo with high confidence when evidence is strong', async () => {
    const github = fakeGithub({
      'package.json': JSON.stringify({ dependencies: { express: '^4.0.0' } }),
      'package-lock.json': '{}',
      'src/controllers/UserController.ts': '',
      'src/services/UserService.ts': '',
      'src/repositories/UserRepository.ts': '',
      'src/models/User.ts': '',
      'src/index.ts': '',
    });

    const result = await analyzeRepository(github, 'acme', 'app', 'sha1');

    expect(result.language).toBe('TypeScript');
    expect(result.framework).toBe('Express');
    expect(result.packageManager).toBe('npm');
    expect(result.layering).toEqual(['Controller', 'Service', 'Repository', 'Model']);
    expect(result.confidence).toBe('high');
    expect(result.entryPoints).toContain('src/index.ts');
  });

  it('reports low confidence for a repo with almost no structural evidence', async () => {
    const github = fakeGithub({ 'README.md': '# hello' });

    const result = await analyzeRepository(github, 'acme', 'empty', 'sha1');

    expect(result.language).toBeNull();
    expect(result.framework).toBeNull();
    expect(result.confidence).toBe('low');
    expect(result.layering).toEqual([]);
  });

  it('only fetches manifest files that are actually present at the root', async () => {
    const fetchedPaths: string[] = [];
    const github: RepoContentSource = {
      async getTree() {
        return {
          truncated: false,
          entries: [{ path: 'package.json', type: 'blob', sha: 'x' }],
        };
      },
      async getFileContent(_owner, _repo, path) {
        fetchedPaths.push(path);
        return '{}';
      },
    };

    await analyzeRepository(github, 'acme', 'app', 'sha1');

    expect(fetchedPaths).toEqual(['package.json']);
  });
});
