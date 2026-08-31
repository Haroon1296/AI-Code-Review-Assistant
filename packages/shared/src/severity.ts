import { IssueCategory, IssueSeverity, SEVERITY_ORDER } from '@acra/types';

export const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

export const CATEGORY_LABEL: Record<IssueCategory, string> = {
  bug: 'Bug',
  security: 'Security',
  performance: 'Performance',
  architecture: 'Architecture',
  quality: 'Code Quality',
  maintainability: 'Maintainability',
  testing: 'Testing',
  style: 'Style',
};

export function sortBySeverity<T extends { severity: IssueSeverity }>(issues: T[]): T[] {
  return [...issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
