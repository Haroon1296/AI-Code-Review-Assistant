'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { RepositoryListItem } from '@acra/types';
import { AuthGuard } from '../../components/auth-guard';
import { apiFetch } from '../../lib/api';

function RepositoriesList() {
  const router = useRouter();
  const [repos, setRepos] = useState<RepositoryListItem[] | null>(null);
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<RepositoryListItem[]>('/api/repositories')
      .then(setRepos)
      .catch((err) => setError(err.message));
  }, []);

  async function handleConnect(repo: RepositoryListItem) {
    setConnectingId(repo.githubRepoId);
    try {
      const detail = await apiFetch<{ id: string }>('/api/repositories', {
        method: 'POST',
        body: JSON.stringify({
          githubRepoId: repo.githubRepoId,
          owner: repo.owner,
          name: repo.name,
          fullName: repo.fullName,
          defaultBranch: repo.defaultBranch,
          private: repo.private,
        }),
      });
      router.push(`/repositories/${detail.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect repository');
    } finally {
      setConnectingId(null);
    }
  }

  if (error) return <p className="text-red-400">{error}</p>;
  if (!repos) return <p className="text-gray-400">Loading repositories...</p>;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Your repositories</h1>
      <div className="divide-y divide-border rounded-lg border border-border bg-panel">
        {repos.map((repo) => (
          <div key={repo.githubRepoId} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{repo.fullName}</p>
              <p className="text-xs text-gray-500">
                Default branch: {repo.defaultBranch} {repo.private && '· Private'}
              </p>
            </div>
            {repo.isConnected && repo.internalId ? (
              <Link
                href={`/repositories/${repo.internalId}`}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-white/5"
              >
                Open
              </Link>
            ) : (
              <button
                onClick={() => handleConnect(repo)}
                disabled={connectingId === repo.githubRepoId}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {connectingId === repo.githubRepoId ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RepositoriesPage() {
  return (
    <AuthGuard>
      <RepositoriesList />
    </AuthGuard>
  );
}
