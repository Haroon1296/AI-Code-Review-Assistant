import type { ArchitectureConfidence, ArchitecturePattern } from '@acra/types';
import type { GithubTree } from '../github/github.types.js';

export interface TreeEntry {
  path: string;
  type: 'blob' | 'tree';
}

/**
 * The subset of GithubService the analyzer needs. Keeping this as a narrow
 * interface (rather than depending on the concrete class) lets unit tests
 * supply a plain fake instead of a real Octokit-backed service.
 */
export interface RepoContentSource {
  getTree(owner: string, repo: string, sha: string): Promise<GithubTree>;
  getFileContent(owner: string, repo: string, path: string, ref: string): Promise<string | null>;
}

export interface StructureSummaryEntry {
  path: string;
  fileCount: number;
}

export interface AnalysisResult {
  language: string | null;
  framework: string | null;
  packageManager: string | null;
  entryPoints: string[];
  structure: StructureSummaryEntry[];
  patterns: ArchitecturePattern[];
  conventions: {
    testingFramework: string | null;
    testingDirectories: string[];
    dominantNamingStyle: string | null;
  };
  layering: string[];
  confidence: ArchitectureConfidence;
}
