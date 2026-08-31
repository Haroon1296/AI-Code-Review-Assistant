import { isExcludedPath } from '@acra/shared';
import type { ArchitectureConfidence, ArchitecturePattern } from '@acra/types';
import type { GithubCompareFile } from '../github/github.types.js';
import type { GithubService } from '../github/github.service.js';
import { selectRelevantFiles } from './file-selector.js';
import { estimateTokens } from './token-estimator.js';
import type {
  ContextBuildSettings,
  ContextBundle,
  ContextChangedFile,
  ContextRelevantFile,
} from './context-builder.types.js';

const MAX_FILE_LINES = 300;

export interface ArchitectureForContext {
  language: string | null;
  framework: string | null;
  packageManager: string | null;
  layering: string[];
  patterns: ArchitecturePattern[];
  conventions: { testingFramework: string | null; testingDirectories: string[]; dominantNamingStyle: string | null };
  confidence: ArchitectureConfidence;
}

function normalizeStatus(status: GithubCompareFile['status']): 'added' | 'modified' | 'removed' | 'renamed' {
  if (status === 'added' || status === 'removed' || status === 'renamed') return status;
  return 'modified';
}

function truncateContent(content: string, maxSizeKb: number): { text: string; truncated: boolean } {
  const maxBytes = maxSizeKb * 1024;
  const lines = content.split('\n');
  const byLineCount = lines.length > MAX_FILE_LINES;
  const limitedByLines = byLineCount ? lines.slice(0, MAX_FILE_LINES).join('\n') : content;

  if (Buffer.byteLength(limitedByLines, 'utf8') <= maxBytes) {
    return { text: limitedByLines, truncated: byLineCount };
  }

  let truncated = limitedByLines;
  while (Buffer.byteLength(truncated, 'utf8') > maxBytes && truncated.length > 0) {
    truncated = truncated.slice(0, Math.floor(truncated.length * 0.9));
  }
  return { text: truncated, truncated: true };
}

function buildArchitectureSummary(architecture: ArchitectureForContext): string {
  const parts: string[] = [];
  parts.push(`Language: ${architecture.language ?? 'unknown'}`);
  parts.push(`Framework: ${architecture.framework ?? 'unknown'}`);
  parts.push(`Package manager: ${architecture.packageManager ?? 'unknown'}`);

  if (architecture.layering.length > 0) {
    parts.push(`Layering (inferred call chain): ${architecture.layering.join(' -> ')}`);
  } else {
    parts.push('Layering: could not be confidently inferred from repository evidence.');
  }

  const detected = architecture.patterns.filter((p) => p.detected).map((p) => p.name);
  const missing = architecture.patterns.filter((p) => !p.detected).map((p) => p.name);
  if (detected.length > 0) parts.push(`Detected patterns: ${detected.join(', ')}`);
  if (missing.length > 0) parts.push(`Patterns not found in this repository: ${missing.join(', ')}`);

  if (architecture.conventions.testingFramework) {
    parts.push(`Testing framework: ${architecture.conventions.testingFramework}`);
  }
  if (architecture.conventions.dominantNamingStyle) {
    parts.push(`Dominant file-naming style: ${architecture.conventions.dominantNamingStyle}`);
  }

  parts.push(`Architecture-detection confidence: ${architecture.confidence}.`);
  if (architecture.confidence === 'low') {
    parts.push(
      'Evidence is thin — do not assert a specific architecture pattern with high confidence; say so if unsure.',
    );
  }

  return parts.join('\n');
}

export async function buildReviewContext(params: {
  github: GithubService;
  owner: string;
  repo: string;
  baseSha: string;
  compareFiles: GithubCompareFile[];
  architecture: ArchitectureForContext;
  settings: ContextBuildSettings;
}): Promise<ContextBundle> {
  const { github, owner, repo, baseSha, compareFiles, architecture, settings } = params;

  const eligibleFiles = compareFiles.filter(
    (f) => !isExcludedPath(f.path, settings.excludedPatterns),
  );
  const changedFilesOmitted = compareFiles.length - eligibleFiles.length;
  const cappedFiles = eligibleFiles.slice(0, settings.maxChangedFiles);
  const changedFilesTruncatedByCap = eligibleFiles.length - cappedFiles.length;

  const changedFiles: ContextChangedFile[] = cappedFiles.map((f) => ({
    path: f.path,
    status: normalizeStatus(f.status),
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? null,
  }));

  const tree = await github.getTree(owner, repo, baseSha);
  const relevantCandidates = selectRelevantFiles(
    tree.entries,
    changedFiles.map((f) => f.path),
    settings.maxRelevantFiles,
    settings.excludedPatterns,
  );

  const relevantFiles: ContextRelevantFile[] = [];
  for (const candidate of relevantCandidates) {
    const content = await github
      .getFileContent(owner, repo, candidate.path, baseSha)
      .catch(() => null);
    if (content === null) continue;
    const { text, truncated } = truncateContent(content, settings.maxFileSizeKb);
    relevantFiles.push({ path: candidate.path, contentExcerpt: text, truncated, reason: candidate.reason });
  }

  const architectureSummary = buildArchitectureSummary(architecture);

  let estimatedTokens =
    estimateTokens(architectureSummary) +
    changedFiles.reduce((sum, f) => sum + estimateTokens(f.patch ?? ''), 0) +
    relevantFiles.reduce((sum, f) => sum + estimateTokens(f.contentExcerpt), 0);

  let relevantFilesOmitted = 0;
  while (estimatedTokens > settings.maxContextTokens && relevantFiles.length > 0) {
    const dropped = relevantFiles.pop();
    if (!dropped) break;
    estimatedTokens -= estimateTokens(dropped.contentExcerpt);
    relevantFilesOmitted += 1;
  }

  return {
    project: {
      language: architecture.language,
      framework: architecture.framework,
      packageManager: architecture.packageManager,
    },
    architectureSummary,
    layering: architecture.layering,
    changedFiles,
    relevantFiles,
    conventions: architecture.conventions,
    limits: {
      changedFilesOmitted: changedFilesOmitted + changedFilesTruncatedByCap,
      relevantFilesOmitted,
      estimatedTokens,
    },
  };
}
