import { describe, expect, it } from 'vitest';
import {
  buildGithubCommentBody,
  type GithubCommentIssue,
  type GithubCommentReviewInfo,
} from './github-comment-formatter.js';

const review: GithubCommentReviewInfo = {
  summary: 'Looks mostly fine.',
  score: 85,
  architectureScore: 80,
  securityScore: 90,
  qualityScore: 85,
  performanceScore: 88,
  testingScore: 70,
};

function makeIssue(overrides: Partial<GithubCommentIssue> = {}): GithubCommentIssue {
  return {
    severity: 'medium',
    category: 'quality',
    file: 'src/a.ts',
    line: 10,
    title: 'Untyped variable',
    message: 'This variable has no explicit type.',
    reason: 'Reduces type safety.',
    suggestion: 'Add an explicit type annotation.',
    ...overrides,
  };
}

describe('buildGithubCommentBody', () => {
  it('includes the score summary and a bullet per issue with full suggestion text', () => {
    const body = buildGithubCommentBody(review, [makeIssue()], 'https://app.example.com/reviews/1');

    expect(body).toContain('AI Code Review');
    expect(body).toContain('**Overall:** 85');
    expect(body).toContain('- **[Medium] Code Quality** `src/a.ts:10` — Untyped variable');
    expect(body).toContain('Add an explicit type annotation.');
    expect(body).toContain('[View full report](https://app.example.com/reviews/1)');
  });

  it('sorts issues by severity, most severe first', () => {
    const body = buildGithubCommentBody(
      review,
      [
        makeIssue({ severity: 'low', title: 'Low one' }),
        makeIssue({ severity: 'critical', title: 'Critical one' }),
      ],
      'https://app.example.com/reviews/1',
    );

    expect(body.indexOf('Critical one')).toBeLessThan(body.indexOf('Low one'));
  });

  it('renders a "no issues" message when there are none', () => {
    const body = buildGithubCommentBody(review, [], 'https://app.example.com/reviews/1');
    expect(body).toContain('No issues found');
  });

  it('caps very large issue lists under GitHub comment length limits and notes what was omitted', () => {
    const manyIssues = Array.from({ length: 2000 }, (_, i) =>
      makeIssue({ title: `Issue ${i}`, message: 'x'.repeat(200) }),
    );

    const body = buildGithubCommentBody(review, manyIssues, 'https://app.example.com/reviews/1');

    expect(body.length).toBeLessThan(65_536);
    expect(body).toMatch(/and \d+ more issues? — see the full report above/);
  });

  it('flattens multi-line issue text onto a single line to keep bullet formatting intact', () => {
    const body = buildGithubCommentBody(
      review,
      [makeIssue({ message: 'line one\nline two' })],
      'https://app.example.com/reviews/1',
    );

    expect(body).toContain('line one line two');
  });
});
