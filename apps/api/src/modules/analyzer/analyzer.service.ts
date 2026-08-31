import { Prisma, type ArchitectureSnapshot } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { createGithubServiceForUser } from '../auth/auth.service.js';
import { requireConnectedRepository } from '../repositories/repositories.service.js';
import { detectLanguage } from './detectors/language.detector.js';
import { detectFramework, type ManifestContents } from './detectors/framework.detector.js';
import { detectPackageManager } from './detectors/package-manager.detector.js';
import { detectPatterns } from './detectors/pattern.detector.js';
import { detectConventions } from './detectors/convention.detector.js';
import type {
  AnalysisResult,
  RepoContentSource,
  StructureSummaryEntry,
  TreeEntry,
} from './analyzer.types.js';

const ROOT_MANIFEST_FILES: Record<keyof ManifestContents, string> = {
  packageJson: 'package.json',
  composerJson: 'composer.json',
  requirementsTxt: 'requirements.txt',
  pyprojectToml: 'pyproject.toml',
  goMod: 'go.mod',
  gemfile: 'Gemfile',
};

const ENTRY_POINT_BASENAMES = new Set([
  'index.ts',
  'index.js',
  'main.ts',
  'main.js',
  'server.ts',
  'server.js',
  'app.ts',
  'app.js',
  'artisan',
  'manage.py',
  'main.go',
  'main.py',
]);

const CANONICAL_LAYERING: Array<{ patternName: string; layerLabel: string }> = [
  { patternName: 'Controllers', layerLabel: 'Controller' },
  { patternName: 'Service Layer', layerLabel: 'Service' },
  { patternName: 'Repository Pattern', layerLabel: 'Repository' },
  { patternName: 'Models', layerLabel: 'Model' },
];

const MAX_TREE_ENTRIES = 20_000;

async function fetchRootManifests(
  github: RepoContentSource,
  owner: string,
  repo: string,
  sha: string,
  rootFiles: Set<string>,
): Promise<ManifestContents> {
  const entries = await Promise.all(
    (Object.entries(ROOT_MANIFEST_FILES) as Array<[keyof ManifestContents, string]>).map(
      async ([key, fileName]) => {
        if (!rootFiles.has(fileName)) return [key, null] as const;
        const content = await github.getFileContent(owner, repo, fileName, sha).catch(() => null);
        return [key, content] as const;
      },
    ),
  );
  return Object.fromEntries(entries) as ManifestContents;
}

function buildStructureSummary(entries: TreeEntry[]): StructureSummaryEntry[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.type !== 'blob') continue;
    const topLevel = entry.path.split('/')[0] ?? entry.path;
    counts.set(topLevel, (counts.get(topLevel) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([path, fileCount]) => ({ path, fileCount }));
}

function findEntryPoints(entries: TreeEntry[]): string[] {
  return entries
    .filter((e) => e.type === 'blob' && ENTRY_POINT_BASENAMES.has(e.path.split('/').pop() ?? ''))
    .map((e) => e.path)
    .slice(0, 5);
}

/** Runs the heuristic architecture analysis for a single commit. Pure w.r.t. its inputs — no DB access. */
export async function analyzeRepository(
  github: RepoContentSource,
  owner: string,
  repo: string,
  sha: string,
): Promise<AnalysisResult> {
  const tree = await github.getTree(owner, repo, sha);
  const entries: TreeEntry[] = tree.truncated ? tree.entries.slice(0, MAX_TREE_ENTRIES) : tree.entries;

  const rootFiles = new Set(
    entries.filter((e) => e.type === 'blob' && !e.path.includes('/')).map((e) => e.path),
  );
  const manifests = await fetchRootManifests(github, owner, repo, sha, rootFiles);

  const { language, evidenceCount: languageEvidence } = detectLanguage(entries);
  const framework = detectFramework(manifests);
  const packageManager = detectPackageManager(entries);
  const patterns = detectPatterns(entries);
  const conventions = detectConventions(entries, manifests);

  const detectedPatternCount = patterns.filter((p) => p.detected).length;
  const layering = CANONICAL_LAYERING.filter(({ patternName }) =>
    patterns.find((p) => p.name === patternName)?.detected,
  ).map(({ layerLabel }) => layerLabel);

  const confidence =
    language && framework && packageManager && detectedPatternCount >= 2
      ? 'high'
      : language && languageEvidence >= 3 && (framework || packageManager) && detectedPatternCount >= 1
        ? 'medium'
        : 'low';

  return {
    language,
    framework,
    packageManager,
    entryPoints: findEntryPoints(entries),
    structure: buildStructureSummary(entries),
    patterns,
    conventions,
    layering,
    confidence,
  };
}

/** Returns the cached snapshot for the branch's current commit, analyzing and persisting one if it doesn't exist yet. */
export async function getOrBuildArchitectureSnapshot(
  userId: string,
  repositoryId: string,
  branch: string,
): Promise<ArchitectureSnapshot> {
  const repository = await requireConnectedRepository(userId, repositoryId);
  const github = await createGithubServiceForUser(userId);
  const sha = await github.getBranchHeadSha(repository.owner, repository.name, branch);

  const existing = await prisma.architectureSnapshot.findUnique({
    where: { repositoryId_commitSha: { repositoryId, commitSha: sha } },
  });
  if (existing) return existing;

  const analysis = await analyzeRepository(github, repository.owner, repository.name, sha);

  return prisma.architectureSnapshot.create({
    data: {
      repositoryId,
      commitSha: sha,
      language: analysis.language,
      framework: analysis.framework,
      packageManager: analysis.packageManager,
      entryPoints: analysis.entryPoints,
      structureJson: analysis.structure as unknown as Prisma.InputJsonValue,
      patternsJson: analysis.patterns as unknown as Prisma.InputJsonValue,
      conventionsJson: analysis.conventions as unknown as Prisma.InputJsonValue,
      layering: analysis.layering,
      confidence: analysis.confidence,
    },
  });
}
