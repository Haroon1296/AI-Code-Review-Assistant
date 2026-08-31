/** Hardcoded defaults. Combined with per-user `ReviewSetting.excludedPatterns` (never replaced by it). */
export const DEFAULT_EXCLUDED_PATTERNS: readonly string[] = [
  '.env',
  '.env.*',
  '*.pem',
  '*.key',
  'id_rsa*',
  'credentials/*',
  'secrets/*',
  '*.p12',
  '*.pfx',
  '*.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',
];

/** Minimal glob matcher supporting `*` and `?` for the exclusion patterns above — no external glob dep needed. */
export function matchesGlob(pattern: string, filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const candidates = pattern.includes('/') ? [normalized] : [normalized, ...segments];

  const regex = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$',
    'i',
  );

  return candidates.some((candidate) => regex.test(candidate));
}

export function isExcludedPath(filePath: string, extraPatterns: readonly string[] = []): boolean {
  const patterns = [...DEFAULT_EXCLUDED_PATTERNS, ...extraPatterns];
  return patterns.some((pattern) => matchesGlob(pattern, filePath));
}
