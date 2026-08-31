import { CATEGORY_LABEL, SEVERITY_LABEL } from '@acra/shared';
import type { IssueCategory, IssueSeverity } from '@acra/types';

const SEVERITY_COLOR: Record<IssueSeverity, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  info: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${SEVERITY_COLOR[severity]}`}>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export function CategoryBadge({ category }: { category: IssueCategory }) {
  return (
    <span className="rounded border border-border bg-white/5 px-2 py-0.5 text-xs font-medium text-gray-300">
      {CATEGORY_LABEL[category]}
    </span>
  );
}

export function ScoreGauge({ label, score }: { label: string; score: number | null }) {
  const color =
    score === null
      ? 'text-gray-500'
      : score >= 85
        ? 'text-emerald-400'
        : score >= 60
          ? 'text-yellow-400'
          : 'text-red-400';

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-panel px-4 py-3">
      <span className={`text-2xl font-bold ${color}`}>{score ?? '—'}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}
