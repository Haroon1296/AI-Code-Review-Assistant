import type { FileChangeStatus } from '@acra/types';
import type { AnalysisResult } from '../analyzer/analyzer.types.js';

export interface ContextChangedFile {
  path: string;
  status: FileChangeStatus;
  additions: number;
  deletions: number;
  patch: string | null;
}

export interface ContextRelevantFile {
  path: string;
  contentExcerpt: string;
  truncated: boolean;
  reason: 'same-directory' | 'same-component';
}

export interface ContextBundle {
  project: {
    language: string | null;
    framework: string | null;
    packageManager: string | null;
  };
  architectureSummary: string;
  layering: string[];
  changedFiles: ContextChangedFile[];
  relevantFiles: ContextRelevantFile[];
  conventions: AnalysisResult['conventions'];
  limits: {
    changedFilesOmitted: number;
    relevantFilesOmitted: number;
    estimatedTokens: number;
  };
}

export interface ContextBuildSettings {
  excludedPatterns: string[];
  maxChangedFiles: number;
  maxRelevantFiles: number;
  maxFileSizeKb: number;
  maxContextTokens: number;
}
