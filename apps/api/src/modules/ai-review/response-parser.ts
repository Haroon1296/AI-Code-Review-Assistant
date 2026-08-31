import { AiReviewOutputSchema, type AiReviewOutput } from '@acra/types';

export class AiReviewParseError extends Error {
  constructor(public readonly issues: string) {
    super(`AI review response failed schema validation: ${issues}`);
    this.name = 'AiReviewParseError';
  }
}

/** Parses and validates the raw JSON string returned by OpenAI against our structured output contract. */
export function parseAiReviewResponse(rawJson: string): AiReviewOutput {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch (err) {
    throw new AiReviewParseError(`invalid JSON: ${(err as Error).message}`);
  }

  const result = AiReviewOutputSchema.safeParse(parsedJson);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new AiReviewParseError(issues);
  }

  return result.data;
}
