import { encode } from 'gpt-tokenizer';

/** Approximate token count for a piece of text (used for budgeting, not billing — actual usage comes from the OpenAI response). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  try {
    return encode(text).length;
  } catch {
    // Fallback heuristic if the tokenizer chokes on unusual input.
    return Math.ceil(text.length / 4);
  }
}
