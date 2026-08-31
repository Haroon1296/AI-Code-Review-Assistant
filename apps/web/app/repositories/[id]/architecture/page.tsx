'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ArchitectureSnapshotDto, RepositoryDetail } from '@acra/types';
import { AuthGuard } from '../../../../components/auth-guard';
import { apiFetch } from '../../../../lib/api';

interface StructureSummaryEntry {
  path: string;
  fileCount: number;
}

function ArchitectureView() {
  const { id } = useParams<{ id: string }>();
  const [repository, setRepository] = useState<RepositoryDetail | null>(null);
  const [snapshot, setSnapshot] = useState<ArchitectureSnapshotDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<RepositoryDetail>(`/api/repositories/${id}`).then((repo) => {
      setRepository(repo);
      apiFetch<ArchitectureSnapshotDto>(
        `/api/repositories/${id}/architecture?branch=${encodeURIComponent(repo.defaultBranch)}`,
      )
        .then(setSnapshot)
        .catch((err) => setError(err.message));
    });
  }, [id]);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!repository || !snapshot) return <p className="text-gray-400">Analyzing repository...</p>;

  const structure = (snapshot.structure as StructureSummaryEntry[] | undefined) ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{repository.fullName} — Architecture</h1>
        <p className="text-sm text-gray-500">
          Analyzed at commit {snapshot.commitSha.slice(0, 7)} · Confidence: {snapshot.confidence}
        </p>
      </div>

      <section className="rounded-lg border border-border bg-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Overview</h2>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Language</dt>
            <dd>{snapshot.language ?? 'Unknown'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Framework</dt>
            <dd>{snapshot.framework ?? 'Unknown'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Package manager</dt>
            <dd>{snapshot.packageManager ?? 'Unknown'}</dd>
          </div>
        </dl>
      </section>

      {snapshot.layering.length > 0 && (
        <section className="rounded-lg border border-border bg-panel p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Inferred layering
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {snapshot.layering.map((layer, i) => (
              <div key={layer} className="flex items-center gap-2">
                <span className="rounded-md border border-border bg-surface px-3 py-1.5">{layer}</span>
                {i < snapshot.layering.length - 1 && <span className="text-gray-500">→</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border bg-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Detected patterns</h2>
        <ul className="space-y-1 text-sm">
          {snapshot.patterns.map((pattern) => (
            <li key={pattern.name} className="flex items-center gap-2">
              <span className={pattern.detected ? 'text-emerald-400' : 'text-gray-600'}>
                {pattern.detected ? '✓' : '·'}
              </span>
              <span className={pattern.detected ? '' : 'text-gray-500'}>{pattern.name}</span>
              {pattern.detected && pattern.evidencePaths[0] && (
                <span className="text-xs text-gray-500">({pattern.evidencePaths[0]})</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Folder structure (top-level)
        </h2>
        <ul className="grid grid-cols-2 gap-1 text-sm text-gray-300 sm:grid-cols-3">
          {structure.map((entry) => (
            <li key={entry.path}>
              {entry.path}/ <span className="text-gray-500">({entry.fileCount})</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function ArchitecturePage() {
  return (
    <AuthGuard>
      <ArchitectureView />
    </AuthGuard>
  );
}
