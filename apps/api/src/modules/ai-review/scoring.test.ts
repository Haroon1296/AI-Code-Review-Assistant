import { describe, expect, it } from 'vitest';
import { estimateCostUsd } from './scoring.js';

describe('estimateCostUsd', () => {
  it('computes cost from input/output tokens using the model price table', () => {
    const cost = estimateCostUsd('gpt-4o-mini', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.15 + 0.6, 5);
  });

  it('returns 0 for a review with no tokens', () => {
    expect(estimateCostUsd('gpt-4o-mini', 0, 0)).toBe(0);
  });

  it('falls back to the default pricing for an unrecognized model', () => {
    const known = estimateCostUsd('default', 1000, 1000);
    const unknown = estimateCostUsd('some-future-model', 1000, 1000);
    expect(unknown).toBe(known);
  });

  it('scales linearly with token count', () => {
    const small = estimateCostUsd('gpt-4.1-mini', 1000, 0);
    const large = estimateCostUsd('gpt-4.1-mini', 10000, 0);
    expect(large).toBeCloseTo(small * 10, 6);
  });
});
