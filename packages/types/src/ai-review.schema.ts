import { z } from 'zod';
import { IssueCategory, IssueSeverity } from './enums.js';

/**
 * Structured output contract for the OpenAI review call. Kept deliberately flat
 * (no nested optionals/defaults) because it is also compiled to a strict JSON
 * Schema for OpenAI's `response_format: json_schema` — every field must be
 * required and JSON-schema-representable.
 */
export const AiReviewIssueSchema = z.object({
  severity: IssueSeverity,
  category: IssueCategory,
  file: z.string().nullable(),
  line: z.number().int().nullable(),
  title: z.string().min(1).max(160),
  message: z.string().min(1),
  reason: z.string().min(1),
  suggestion: z.string().min(1),
});
export type AiReviewIssue = z.infer<typeof AiReviewIssueSchema>;

export const AiReviewOutputSchema = z.object({
  summary: z.string().min(1),
  score: z.number().int().min(0).max(100),
  architecture_score: z.number().int().min(0).max(100),
  security_score: z.number().int().min(0).max(100),
  quality_score: z.number().int().min(0).max(100),
  performance_score: z.number().int().min(0).max(100),
  testing_score: z.number().int().min(0).max(100),
  architecture_confidence_note: z.string().min(1),
  issues: z.array(AiReviewIssueSchema),
});
export type AiReviewOutput = z.infer<typeof AiReviewOutputSchema>;
