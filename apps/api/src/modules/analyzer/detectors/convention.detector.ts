import type { TreeEntry } from '../analyzer.types.js';
import type { ManifestContents } from './framework.detector.js';

const TEST_DIR_MATCHER = /(^|\/)(tests?|__tests__|spec)(\/|$)/i;
const CODE_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'php', 'py', 'go', 'rb', 'java', 'kt', 'cs']);

const TEST_FRAMEWORK_MARKERS: Array<{ marker: string; framework: string }> = [
  { marker: 'vitest', framework: 'Vitest' },
  { marker: 'jest', framework: 'Jest' },
  { marker: 'mocha', framework: 'Mocha' },
  { marker: 'playwright', framework: 'Playwright' },
  { marker: 'cypress', framework: 'Cypress' },
  { marker: 'phpunit/phpunit', framework: 'PHPUnit' },
  { marker: 'pytest', framework: 'pytest' },
];

type NamingStyle = 'PascalCase' | 'camelCase' | 'snake_case' | 'kebab-case';

function classifyBaseName(baseName: string): NamingStyle | null {
  if (/^[A-Z][A-Za-z0-9]*$/.test(baseName)) return 'PascalCase';
  if (/^[a-z][a-zA-Z0-9]*$/.test(baseName)) return 'camelCase';
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(baseName)) return 'snake_case';
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(baseName)) return 'kebab-case';
  return null;
}

export interface ConventionResult {
  testingFramework: string | null;
  testingDirectories: string[];
  dominantNamingStyle: string | null;
}

export function detectConventions(entries: TreeEntry[], manifests: ManifestContents): ConventionResult {
  const files = entries.filter((e) => e.type === 'blob');

  const testingDirectories = [...new Set(
    files.filter((f) => TEST_DIR_MATCHER.test(f.path)).map((f) => f.path.split('/').slice(0, -1).join('/')),
  )].slice(0, 5);

  const manifestText = Object.values(manifests).filter(Boolean).join('\n').toLowerCase();
  const testingFramework =
    TEST_FRAMEWORK_MARKERS.find(({ marker }) => manifestText.includes(marker))?.framework ?? null;

  const styleCounts = new Map<NamingStyle, number>();
  for (const file of files) {
    const segments = file.path.split('/');
    const fileName = segments[segments.length - 1] ?? '';
    const dotIndex = fileName.lastIndexOf('.');
    const ext = dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : '';
    if (!CODE_EXTENSIONS.has(ext)) continue;

    const baseName = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
    const style = classifyBaseName(baseName);
    if (style) styleCounts.set(style, (styleCounts.get(style) ?? 0) + 1);
  }

  let dominantNamingStyle: string | null = null;
  let bestCount = 0;
  for (const [style, count] of styleCounts) {
    if (count > bestCount) {
      dominantNamingStyle = style;
      bestCount = count;
    }
  }

  return { testingFramework, testingDirectories, dominantNamingStyle };
}
