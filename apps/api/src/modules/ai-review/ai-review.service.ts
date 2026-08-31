import OpenAI from 'openai';
import type { AiReviewOutput } from '@acra/types';
import { env } from '../../config/env.js';
import { logger } from '../../common/logger.js';
import type { ContextBundle } from '../context-builder/context-builder.types.js';
import { AI_REVIEW_SYSTEM_PROMPT, buildAiReviewUserPrompt } from './prompt-builder.js';
import { AI_REVIEW_JSON_SCHEMA } from './schema.js';
import { AiReviewParseError, parseAiReviewResponse } from './response-parser.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface AiReviewResult {
  output: AiReviewOutput;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Calls OpenAI for a structured review, retrying once (with a corrective follow-up) if the response fails schema validation. */
export async function runAiReview(
  bundle: ContextBundle,
  options: { model?: string; maxOutputTokens?: number } = {},
): Promise<AiReviewResult> {
  const model = options.model ?? env.OPENAI_MODEL;
  const maxTokens = options.maxOutputTokens ?? env.OPENAI_MAX_OUTPUT_TOKENS;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: AI_REVIEW_SYSTEM_PROMPT },
    { role: 'user', content: buildAiReviewUserPrompt(bundle) },
  ];

  let lastError: AiReviewParseError | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt === 1 && lastError) {
      messages.push({
        role: 'user',
        content: `Your previous response was not valid JSON matching the schema (${lastError.issues}). Respond again with ONLY corrected JSON matching the schema.`,
      });
    }

    const response = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      response_format: { type: 'json_schema', json_schema: AI_REVIEW_JSON_SCHEMA },
    });

    const rawContent = response.choices[0]?.message?.content ?? '';
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    try {
      const output = parseAiReviewResponse(rawContent);
      return { output, model, inputTokens, outputTokens };
    } catch (err) {
      if (err instanceof AiReviewParseError) {
        lastError = err;
        logger.warn({ attempt, issues: err.issues }, 'AI review response failed validation, retrying');
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error('AI review failed for an unknown reason');
}
