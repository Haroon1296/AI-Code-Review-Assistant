'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type {
  IssueCategory,
  IssueSeverity,
  PostReviewCommentResponse,
  ReviewDetailDto,
  ReviewFileDto,
  ReviewIssueDto,
} from '@acra/types';
import { AuthGuard } from '../../../components/auth-guard';
import { CategoryBadge, ScoreGauge, SeverityBadge } from '../../../components/badges';
import { apiFetch, ApiRequestError } from '../../../lib/api';

const IN_PROGRESS_STATUSES = new Set(['pending', 'analyzing', 'reviewing']);
const SEVERITY_FILTERS: Array<IssueSeverity | 'all'> = [
  'all',
  'critical',
  'high',
  'medium',
  'low',
  'info',
];
const CATEGORY_FILTERS: Array<IssueCategory | 'all'> = [
  'all',
  'architecture',
  'security',
  'bug',
  'performance',
  'quality',
  'maintainability',
  'testing',
  'style',
];

function ReviewDashboard() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<ReviewDetailDto | null>(null);
  const [issues, setIssues] = useState<ReviewIssueDto[] | null>(null);
  const [files, setFiles] = useState<ReviewFileDto[] | null>(null);
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory | 'all'>('all');
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    async function load() {
      const detail = await apiFetch<ReviewDetailDto>(`/api/reviews/${id}`);
      setReview(detail);
      if (detail.status === 'completed') {
        const [issuesRes, filesRes] = await Promise.all([
          apiFetch<ReviewIssueDto[]>(`/api/reviews/${id}/issues`),
          apiFetch<ReviewFileDto[]>(`/api/reviews/${id}/files`),
        ]);
        setIssues(issuesRes);
        setFiles(filesRes);
      }
      if (!IN_PROGRESS_STATUSES.has(detail.status) && pollRef.current) {
        clearInterval(pollRef.current);
      }
    }

    load();
    pollRef.current = setInterval(load, 3000);
    return () => clearInterval(pollRef.current);
  }, [id]);

  async function handlePostComment() {
    setPosting(true);
    setPostError(null);
    try {
      const result = await apiFetch<PostReviewCommentResponse>(`/api/reviews/${id}/post-comment`, {
        method: 'POST',
      });
      setReview((prev) => (prev ? { ...prev, ...result } : prev));
    } catch (err) {
      setPostError(
        err instanceof ApiRequestError ? err.message : 'Failed to post comment to GitHub',
      );
    } finally {
      setPosting(false);
    }
  }

  if (!review) return <p className="text-gray-400">Loading review...</p>;

  if (IN_PROGRESS_STATUSES.has(review.status)) {
    return (
      <div className="max-w-xl rounded-lg border border-border bg-panel p-6">
        <p className="font-medium">Review in progress — {review.status}</p>
        <p className="mt-2 text-sm text-gray-500">
          {review.repositoryFullName}: {review.baseBranch} ← {review.headBranch}
        </p>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-500" />
        </div>
      </div>
    );
  }

  if (review.status === 'failed') {
    return (
      <div className="max-w-xl rounded-lg border border-red-500/30 bg-red-500/10 p-6">
        <p className="font-medium text-red-400">Review failed</p>
        <p className="mt-2 text-sm text-gray-400">
          {review.errorMessage ?? 'An unknown error occurred.'}
        </p>
      </div>
    );
  }

  const filteredIssues = (issues ?? []).filter(
    (issue) =>
      (severityFilter === 'all' || issue.severity === severityFilter) &&
      (categoryFilter === 'all' || issue.category === categoryFilter),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          {review.repositoryFullName}: {review.baseBranch} → {review.headBranch}
        </h1>
        <p className="mt-1 text-sm text-gray-400">{review.summary}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <ScoreGauge label="Overall" score={review.score} />
        <ScoreGauge label="Architecture" score={review.architectureScore} />
        <ScoreGauge label="Security" score={review.securityScore} />
        <ScoreGauge label="Quality" score={review.qualityScore} />
        <ScoreGauge label="Performance" score={review.performanceScore} />
        <ScoreGauge label="Testing" score={review.testingScore} />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-panel p-4">
        <button
          onClick={handlePostComment}
          disabled={posting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {posting
            ? 'Posting...'
            : review.githubCommentUrl
              ? 'Update GitHub comment'
              : 'Post to GitHub'}
        </button>
        {review.githubCommentUrl && (
          <a
            href={review.githubCommentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-400 hover:underline"
          >
            Posted
            {review.githubCommentTarget === 'pull_request'
              ? ' to pull request'
              : ' as commit comment'}{' '}
            →
          </a>
        )}
        {postError && <p className="w-full text-sm text-red-400">{postError}</p>}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {SEVERITY_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`rounded-full border px-3 py-1 text-xs capitalize ${
                severityFilter === s
                  ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                  : 'border-border text-gray-400'
              }`}
            >
              {s}
            </button>
          ))}
          <span className="mx-1 text-gray-600">|</span>
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`rounded-full border px-3 py-1 text-xs capitalize ${
                categoryFilter === c
                  ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                  : 'border-border text-gray-400'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredIssues.map((issue) => (
            <div key={issue.id} className="rounded-lg border border-border bg-panel p-4">
              <div className="mb-2 flex items-center gap-2">
                <SeverityBadge severity={issue.severity} />
                <CategoryBadge category={issue.category} />
                {issue.file && (
                  <span className="text-xs text-gray-500">
                    {issue.file}
                    {issue.line ? `:${issue.line}` : ''}
                  </span>
                )}
              </div>
              <p className="font-medium">{issue.title}</p>
              <p className="mt-1 text-sm text-gray-400">{issue.message}</p>
              <p className="mt-2 text-sm text-gray-500">
                <span className="font-semibold text-gray-400">Why: </span>
                {issue.reason}
              </p>
              <p className="mt-1 text-sm text-emerald-400/90">
                <span className="font-semibold">Suggestion: </span>
                {issue.suggestion}
              </p>
            </div>
          ))}
          {filteredIssues.length === 0 && (
            <p className="text-sm text-gray-500">No issues match this filter.</p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          Changed files
        </h2>
        <div className="divide-y divide-border rounded-lg border border-border bg-panel">
          {(files ?? []).map((file) => (
            <div key={file.id}>
              <button
                onClick={() => setExpandedFile(expandedFile === file.id ? null : file.id)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-white/5"
              >
                <span>{file.filePath}</span>
                <span className="text-xs text-gray-500">
                  {file.status} · +{file.additions}/-{file.deletions}
                </span>
              </button>
              {expandedFile === file.id && file.patch && (
                <pre className="overflow-x-auto bg-black/40 p-4 text-xs text-gray-300">
                  {file.patch}
                </pre>
              )}
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-gray-600">
        Model: {review.model} · Tokens: {review.inputTokens}/{review.outputTokens} · Est. cost: $
        {review.estimatedCostUsd?.toFixed(4)}
      </p>
    </div>
  );
}

export default function ReviewDetailPage() {
  return (
    <AuthGuard>
      <ReviewDashboard />
    </AuthGuard>
  );
}
