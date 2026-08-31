import { describe, expect, it } from 'vitest';
import { detectPatterns } from './pattern.detector.js';

describe('detectPatterns', () => {
  it('detects a Laravel-style layered structure with evidence paths', () => {
    const patterns = detectPatterns([
      { path: 'app/Http/Controllers/PaymentController.php', type: 'blob' },
      { path: 'app/Services/PaymentService.php', type: 'blob' },
      { path: 'app/Repositories/PaymentRepository.php', type: 'blob' },
      { path: 'app/Models/Payment.php', type: 'blob' },
      { path: 'README.md', type: 'blob' },
    ]);

    const byName = Object.fromEntries(patterns.map((p) => [p.name, p]));
    expect(byName['Controllers']?.detected).toBe(true);
    expect(byName['Controllers']?.evidencePaths).toContain('app/Http/Controllers/PaymentController.php');
    expect(byName['Service Layer']?.detected).toBe(true);
    expect(byName['Repository Pattern']?.detected).toBe(true);
    expect(byName['Models']?.detected).toBe(true);
    expect(byName['Jobs / Background Tasks']?.detected).toBe(false);
    expect(byName['Jobs / Background Tasks']?.evidencePaths).toEqual([]);
  });

  it('does not claim a pattern exists when there is no matching directory', () => {
    const patterns = detectPatterns([{ path: 'index.js', type: 'blob' }]);
    expect(patterns.every((p) => !p.detected)).toBe(true);
  });
});
