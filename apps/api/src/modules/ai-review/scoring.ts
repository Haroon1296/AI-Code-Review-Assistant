/**
 * Static per-1M-token pricing used only to produce an estimated cost logged
 * against each review — not billing-accurate, and easy to update as pricing
 * changes. Falls back to the `default` entry for an unrecognized model.
 */
const PRICE_PER_MILLION_TOKENS_USD: Record<string, { input: number; output: number }> = {
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  default: { input: 1.0, output: 3.0 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICE_PER_MILLION_TOKENS_USD[model] ?? PRICE_PER_MILLION_TOKENS_USD.default!;
  const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
