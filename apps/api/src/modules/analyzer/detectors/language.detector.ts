import type { TreeEntry } from '../analyzer.types.js';

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  php: 'PHP',
  py: 'Python',
  go: 'Go',
  rb: 'Ruby',
  java: 'Java',
  kt: 'Kotlin',
  cs: 'C#',
  rs: 'Rust',
};

/**
 * Detects the dominant language by counting source-file extensions. Ignores
 * common vendored/build directories so a `node_modules` or `vendor` folder
 * (should already be excluded by .gitignore, but be defensive) can't skew it.
 */
export function detectLanguage(entries: TreeEntry[]): { language: string | null; evidenceCount: number } {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    if (entry.type !== 'blob') continue;
    if (/(^|\/)(node_modules|vendor|dist|build|\.next|target)\//.test(entry.path)) continue;

    const match = /\.([a-zA-Z0-9]+)$/.exec(entry.path);
    const ext = match?.[1]?.toLowerCase();
    const language = ext ? EXTENSION_TO_LANGUAGE[ext] : undefined;
    if (!language) continue;

    counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [language, count] of counts) {
    if (count > bestCount) {
      best = language;
      bestCount = count;
    }
  }

  return { language: best, evidenceCount: bestCount };
}
