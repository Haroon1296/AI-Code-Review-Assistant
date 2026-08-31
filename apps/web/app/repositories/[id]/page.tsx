'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { BranchSummary, RepositoryDetail } from '@acra/types';
import { AuthGuard } from '../../../components/auth-guard';
import { apiFetch } from '../../../lib/api';

function RepositoryDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [repository, setRepository] = useState<RepositoryDetail | null>(null);
  const [branches, setBranches] = useState<BranchSummary[] | null>(null);
  const [baseBranch, setBaseBranch] = useState('');
  const [headBranch, setHeadBranch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<RepositoryDetail>(`/api/repositories/${id}`).then((repo) => {
      setRepository(repo);
      setBaseBranch(repo.defaultBranch);
    });
    apiFetch<BranchSummary[]>(`/api/repositories/${id}/branches`).then(setBranches);
  }, [id]);

  const sameBranchSelected = Boolean(headBranch) && headBranch === baseBranch;

  async function handleStartReview() {
    if (!baseBranch || !headBranch || sameBranchSelected) return;
    setSubmitting(true);
    setError(null);
    try {
      const review = await apiFetch<{ id: string }>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ repositoryId: id, baseBranch, headBranch }),
      });
      router.push(`/reviews/${review.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start review');
    } finally {
      setSubmitting(false);
    }
  }

  if (!repository || !branches) return <p className="text-gray-400">Loading...</p>;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{repository.fullName}</h1>
        <Link href={`/repositories/${id}/architecture`} className="text-sm text-blue-400 hover:underline">
          View architecture analysis →
        </Link>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-panel p-5">
        <div>
          <label htmlFor="base-branch" className="mb-1 block text-sm text-gray-400">
            Base branch
          </label>
          <select
            id="base-branch"
            value={baseBranch}
            onChange={(e) => setBaseBranch(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="head-branch" className="mb-1 block text-sm text-gray-400">
            Feature / review branch
          </label>
          <select
            id="head-branch"
            value={headBranch}
            onChange={(e) => setHeadBranch(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="">Select a branch...</option>
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {sameBranchSelected && (
          <p className="text-sm text-yellow-400">
            Base and feature branch are the same — pick a different feature branch to review.
          </p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={handleStartReview}
          disabled={submitting || !headBranch || sameBranchSelected}
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {submitting ? 'Starting review...' : 'Start Review'}
        </button>
      </div>
    </div>
  );
}

export default function RepositoryDetailPage() {
  return (
    <AuthGuard>
      <RepositoryDetailView />
    </AuthGuard>
  );
}
