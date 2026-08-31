'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ReviewSummaryDto } from '@acra/types';
import { AuthGuard } from '../../components/auth-guard';
import { apiFetch } from '../../lib/api';

const STATUS_LABEL: Record<ReviewSummaryDto['status'], string> = {
  pending: 'Pending',
  analyzing: 'Analyzing',
  reviewing: 'Reviewing',
  completed: 'Completed',
  failed: 'Failed',
};

function ReviewHistoryList() {
  const [reviews, setReviews] = useState<ReviewSummaryDto[] | null>(null);

  useEffect(() => {
    apiFetch<{ items: ReviewSummaryDto[] }>('/api/reviews').then((res) => setReviews(res.items));
  }, []);

  if (!reviews) return <p className="text-gray-400">Loading review history...</p>;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Review history</h1>
      {reviews.length === 0 && <p className="text-sm text-gray-500">No reviews yet. Start one from a repository.</p>}
      <div className="divide-y divide-border rounded-lg border border-border bg-panel">
        {reviews.map((review) => (
          <Link
            key={review.id}
            href={`/reviews/${review.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-white/5"
          >
            <div>
              <p className="font-medium">{review.repositoryFullName}</p>
              <p className="text-xs text-gray-500">
                {review.baseBranch} ← {review.headBranch} · {new Date(review.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-400">{review.issueCount} issue(s)</span>
              <span className="font-semibold">{review.score ?? '—'}/100</span>
              <span className="rounded border border-border px-2 py-0.5 text-xs">
                {STATUS_LABEL[review.status]}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <AuthGuard>
      <ReviewHistoryList />
    </AuthGuard>
  );
}
