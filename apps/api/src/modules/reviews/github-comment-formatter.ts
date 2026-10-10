import { CATEGORY_LABEL, SEVERITY_LABEL, sortBySeverity } from '@acra/shared';
import type { IssueCategory, IssueSeverity } from '@acra/types';

// Stay safely under GitHub's 65,536-character comment body limit.
const MAX_COMMENT_LENGTH = 60_000;

export interface GithubCommentReviewInfo {
  summary: string | null;
  score: number | null;
  architectureScore: number | null;
  securityScore: number | null;
  qualityScore: number | null;
  performanceScore: number | null;
  testingScore: number | null;
}

export interface GithubCommentIssue {
  severity: IssueSeverity;
  category: IssueCategory;
  file: string | null;
  line: number | null;
  title: string;
  message: string;
  reason: string;
  suggestion: string;
}

function singleLine(text: string): string {
  return text.replace(/\r?\n+/g, ' ').trim();
}

function scoreLine(label: string, score: number | null): string {
  return `**${label}:** ${score ?? '—'}`;
}

function buildHeader(review: GithubCommentReviewInfo, issueCount: number): string {
  const parts = [
    `## 🤖 AI Code Review — ${issueCount} issue${issueCount === 1 ? '' : 's'} found`,
    review.summary ? singleLine(review.summary) : null,
    [
      scoreLine('Overall', review.score),
      scoreLine('Architecture', review.architectureScore),
      scoreLine('Security', review.securityScore),
      scoreLine('Quality', review.qualityScore),
      scoreLine('Performance', review.performanceScore),
      scoreLine('Testing', review.testingScore),
    ].join(' · '),
  ];
  return parts.filter(Boolean).join('\n\n');
}

function buildIssueBullet(issue: GithubCommentIssue): string {
  const location = issue.file ? `\`${issue.file}${issue.line ? `:${issue.line}` : ''}\`` : null;
  const heading = [
    `**[${SEVERITY_LABEL[issue.severity]}] ${CATEGORY_LABEL[issue.category]}**`,
    location,
    `— ${singleLine(issue.title)}`,
  ]
    .filter(Boolean)
    .join(' ');

  return [
    `- ${heading}`,
    `  ${singleLine(issue.message)}`,
    `  *Why:* ${singleLine(issue.reason)}`,
    `  *Suggestion:* ${singleLine(issue.suggestion)}`,
  ].join('\n');
}

/** Formats a review's issues into a GitHub-comment-ready Markdown body, capped near GitHub's length limit. */
export function buildGithubCommentBody(
  review: GithubCommentReviewInfo,
  issues: GithubCommentIssue[],
  webReviewUrl: string,
): string {
  const sorted = sortBySeverity(issues);
  const header = buildHeader(review, sorted.length);
  const footer = `\n\n---\n[View full report](${webReviewUrl}) · Posted by AI Code Review Assistant`;

  const bullets: string[] = [];
  let runningLength = header.length + footer.length;

  for (const issue of sorted) {
    const bullet = buildIssueBullet(issue);
    if (bullets.length > 0 && runningLength + bullet.length + 2 > MAX_COMMENT_LENGTH) break;
    bullets.push(bullet);
    runningLength += bullet.length + 2;
  }

  const omitted = sorted.length - bullets.length;
  const omittedNote =
    omitted > 0
      ? `\n\n_...and ${omitted} more issue${omitted === 1 ? '' : 's'} — see the full report above._`
      : '';
  const body = bullets.length > 0 ? bullets.join('\n\n') : '_No issues found._';

  return `${header}\n\n${body}${omittedNote}${footer}`;
}
