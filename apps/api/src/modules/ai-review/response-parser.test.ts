import { describe, expect, it } from 'vitest';
import { AiReviewParseError, parseAiReviewResponse } from './response-parser.js';

function validPayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    summary: 'Looks good overall.',
    score: 90,
    architecture_score: 85,
    security_score: 95,
    quality_score: 88,
    performance_score: 92,
    testing_score: 70,
    architecture_confidence_note: 'High confidence based on strong directory evidence.',
    issues: [],
    ...overrides,
  });
}

describe('parseAiReviewResponse', () => {
  it('parses a valid structured response', () => {
    const result = parseAiReviewResponse(validPayload());
    expect(result.score).toBe(90);
    expect(result.issues).toEqual([]);
  });

  it('parses issues with nullable file/line fields', () => {
    const result = parseAiReviewResponse(
      validPayload({
        issues: [
          {
            severity: 'high',
            category: 'architecture',
            file: 'app/Http/Controllers/PaymentController.php',
            line: 45,
            title: 'Business logic inside controller',
            message: 'The controller queries the database directly.',
            reason: 'The repository uses a Service/Repository layer everywhere else.',
            suggestion: 'Move this logic into PaymentService.',
          },
        ],
      }),
    );
    expect(result.issues[0]?.line).toBe(45);
  });

  it('throws AiReviewParseError on malformed JSON', () => {
    expect(() => parseAiReviewResponse('{not json')).toThrow(AiReviewParseError);
  });

  it('throws AiReviewParseError when a required field is missing', () => {
    const payload = JSON.parse(validPayload());
    delete payload.summary;
    expect(() => parseAiReviewResponse(JSON.stringify(payload))).toThrow(AiReviewParseError);
  });

  it('throws AiReviewParseError when score is out of range', () => {
    expect(() => parseAiReviewResponse(validPayload({ score: 150 }))).toThrow(AiReviewParseError);
  });

  it('throws AiReviewParseError on an unrecognized severity value', () => {
    const payload = validPayload({
      issues: [
        {
          severity: 'catastrophic',
          category: 'bug',
          file: null,
          line: null,
          title: 't',
          message: 'm',
          reason: 'r',
          suggestion: 's',
        },
      ],
    });
    expect(() => parseAiReviewResponse(payload)).toThrow(AiReviewParseError);
  });
});
