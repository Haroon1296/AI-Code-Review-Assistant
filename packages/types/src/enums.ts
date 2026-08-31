import { z } from 'zod';

export const ReviewStatus = z.enum(['pending', 'analyzing', 'reviewing', 'completed', 'failed']);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const IssueSeverity = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type IssueSeverity = z.infer<typeof IssueSeverity>;

export const IssueCategory = z.enum([
  'bug',
  'security',
  'performance',
  'architecture',
  'quality',
  'maintainability',
  'testing',
  'style',
]);
export type IssueCategory = z.infer<typeof IssueCategory>;

export const FileChangeStatus = z.enum(['added', 'modified', 'removed', 'renamed']);
export type FileChangeStatus = z.infer<typeof FileChangeStatus>;

export const ArchitectureConfidence = z.enum(['low', 'medium', 'high']);
export type ArchitectureConfidence = z.infer<typeof ArchitectureConfidence>;

/** Ordering used for sorting issue lists and applying severity thresholds. */
export const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};
