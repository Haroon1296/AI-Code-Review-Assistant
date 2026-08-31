import type { TreeEntry } from '../analyzer.types.js';

const LOCKFILE_TO_MANAGER: Array<{ file: string; manager: string }> = [
  { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  { file: 'yarn.lock', manager: 'yarn' },
  { file: 'package-lock.json', manager: 'npm' },
  { file: 'composer.lock', manager: 'composer' },
  { file: 'poetry.lock', manager: 'poetry' },
  { file: 'Pipfile.lock', manager: 'pipenv' },
  { file: 'requirements.txt', manager: 'pip' },
  { file: 'Gemfile.lock', manager: 'bundler' },
  { file: 'go.sum', manager: 'go modules' },
  { file: 'Cargo.lock', manager: 'cargo' },
  { file: 'pom.xml', manager: 'maven' },
  { file: 'build.gradle', manager: 'gradle' },
  { file: 'build.gradle.kts', manager: 'gradle' },
];

/** Detects the package manager from lockfile/manifest presence at the repo root. */
export function detectPackageManager(entries: TreeEntry[]): string | null {
  const rootFiles = new Set(
    entries.filter((e) => e.type === 'blob' && !e.path.includes('/')).map((e) => e.path),
  );

  for (const { file, manager } of LOCKFILE_TO_MANAGER) {
    if (rootFiles.has(file)) return manager;
  }
  return null;
}
