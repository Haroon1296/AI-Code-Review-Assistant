import { describe, expect, it } from 'vitest';
import { selectRelevantFiles } from './file-selector.js';

const TREE = [
  { path: 'app/Http/Controllers/PaymentController.php', type: 'blob' as const },
  { path: 'app/Http/Controllers/OrderController.php', type: 'blob' as const },
  { path: 'app/Services/PaymentService.php', type: 'blob' as const },
  { path: 'app/Repositories/PaymentRepository.php', type: 'blob' as const },
  { path: 'app/Models/Payment.php', type: 'blob' as const },
  { path: '.env', type: 'blob' as const },
];

describe('selectRelevantFiles', () => {
  it('picks same-directory siblings of a changed file', () => {
    const result = selectRelevantFiles(TREE, ['app/Http/Controllers/PaymentController.php'], 10);
    expect(result.map((r) => r.path)).toContain('app/Http/Controllers/OrderController.php');
  });

  it('picks same-component files across layers by stripping the layer suffix', () => {
    const result = selectRelevantFiles(TREE, ['app/Http/Controllers/PaymentController.php'], 10);
    const paths = result.map((r) => r.path);
    expect(paths).toContain('app/Services/PaymentService.php');
    expect(paths).toContain('app/Repositories/PaymentRepository.php');
  });

  it('never selects a changed file as its own relevant file', () => {
    const result = selectRelevantFiles(TREE, ['app/Http/Controllers/PaymentController.php'], 10);
    expect(result.map((r) => r.path)).not.toContain('app/Http/Controllers/PaymentController.php');
  });

  it('respects the excluded-patterns list even for an otherwise-relevant same-directory file', () => {
    const result = selectRelevantFiles(TREE, ['app/Http/Controllers/PaymentController.php'], 10, [
      'OrderController.php',
    ]);
    expect(result.map((r) => r.path)).not.toContain('app/Http/Controllers/OrderController.php');
  });

  it('caps the number of candidates returned', () => {
    const result = selectRelevantFiles(TREE, ['app/Http/Controllers/PaymentController.php'], 1);
    expect(result.length).toBe(1);
  });
});
