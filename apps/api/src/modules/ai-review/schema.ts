import { IssueCategory, IssueSeverity } from '@acra/types';

/**
 * Hand-written JSON Schema mirroring `AiReviewOutputSchema` in @acra/types.
 * OpenAI's strict `response_format: json_schema` mode requires every property
 * to be listed in `required` and `additionalProperties: false` at every
 * level, which a generic zod-to-json-schema conversion doesn't guarantee —
 * kept in sync manually since the shape is small and stable.
 */
export const AI_REVIEW_JSON_SCHEMA = {
  name: 'code_review_result',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      score: { type: 'integer', minimum: 0, maximum: 100 },
      architecture_score: { type: 'integer', minimum: 0, maximum: 100 },
      security_score: { type: 'integer', minimum: 0, maximum: 100 },
      quality_score: { type: 'integer', minimum: 0, maximum: 100 },
      performance_score: { type: 'integer', minimum: 0, maximum: 100 },
      testing_score: { type: 'integer', minimum: 0, maximum: 100 },
      architecture_confidence_note: { type: 'string' },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            severity: { type: 'string', enum: IssueSeverity.options },
            category: { type: 'string', enum: IssueCategory.options },
            file: { type: ['string', 'null'] },
            line: { type: ['integer', 'null'] },
            title: { type: 'string' },
            message: { type: 'string' },
            reason: { type: 'string' },
            suggestion: { type: 'string' },
          },
          required: [
            'severity',
            'category',
            'file',
            'line',
            'title',
            'message',
            'reason',
            'suggestion',
          ],
        },
      },
    },
    required: [
      'summary',
      'score',
      'architecture_score',
      'security_score',
      'quality_score',
      'performance_score',
      'testing_score',
      'architecture_confidence_note',
      'issues',
    ],
  },
} as const;
