import type { ArchitecturePattern } from '@acra/types';
import type { TreeEntry } from '../analyzer.types.js';

interface PatternDefinition {
  name: string;
  matcher: RegExp;
}

const MAX_EVIDENCE_PATHS = 2;

/**
 * Directory/filename heuristics for common layered-architecture patterns.
 * Deliberately covers both Laravel-style (`app/Http/Controllers`) and generic
 * Node-style (`src/controllers`) layouts — we don't assume a specific framework.
 */
const PATTERN_DEFINITIONS: PatternDefinition[] = [
  { name: 'Controllers', matcher: /(^|\/)controllers?(\/|$)/i },
  { name: 'Service Layer', matcher: /(^|\/)services?(\/|$)/i },
  { name: 'Repository Pattern', matcher: /(^|\/)repositories?(\/|$)/i },
  { name: 'Models', matcher: /(^|\/)models?(\/|$)/i },
  { name: 'DTOs', matcher: /(^|\/)dtos?(\/|$)|dto\.[a-z]+$/i },
  { name: 'Validators / Form Requests', matcher: /(^|\/)(validators?|requests)(\/|$)/i },
  { name: 'Jobs / Background Tasks', matcher: /(^|\/)jobs?(\/|$)/i },
  { name: 'Events', matcher: /(^|\/)events?(\/|$)/i },
  { name: 'Middleware', matcher: /(^|\/)middlewares?(\/|$)/i },
  { name: 'API Resources', matcher: /(^|\/)resources?(\/|$)/i },
];

export function detectPatterns(entries: TreeEntry[]): ArchitecturePattern[] {
  const files = entries.filter((e) => e.type === 'blob');

  return PATTERN_DEFINITIONS.map(({ name, matcher }) => {
    const matches = files.filter((f) => matcher.test(f.path));
    return {
      name,
      detected: matches.length > 0,
      evidencePaths: matches.slice(0, MAX_EVIDENCE_PATHS).map((f) => f.path),
    };
  });
}
