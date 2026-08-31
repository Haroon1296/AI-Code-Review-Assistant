import { describe, expect, it } from 'vitest';
import { detectLanguage } from './language.detector.js';

describe('detectLanguage', () => {
  it('picks the extension with the most source files', () => {
    const result = detectLanguage([
      { path: 'src/a.ts', type: 'blob' },
      { path: 'src/b.ts', type: 'blob' },
      { path: 'src/c.php', type: 'blob' },
      { path: 'src', type: 'tree' },
    ]);

    expect(result.language).toBe('TypeScript');
    expect(result.evidenceCount).toBe(2);
  });

  it('ignores vendored/build directories', () => {
    const result = detectLanguage([
      { path: 'node_modules/pkg/index.js', type: 'blob' },
      { path: 'vendor/lib/file.php', type: 'blob' },
      { path: 'src/app.py', type: 'blob' },
    ]);

    expect(result.language).toBe('Python');
  });

  it('returns null when nothing recognizable is present', () => {
    const result = detectLanguage([{ path: 'README.md', type: 'blob' }]);
    expect(result.language).toBeNull();
    expect(result.evidenceCount).toBe(0);
  });
});
