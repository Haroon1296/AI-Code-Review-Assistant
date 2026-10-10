import { z } from 'zod';
import {
  ArchitectureConfidence,
  FileChangeStatus,
  GithubCommentTarget,
  IssueCategory,
  IssueSeverity,
  ReviewStatus,
} from './enums.js';

// --- Auth ---

export const AuthMeResponseSchema = z.object({
  id: z.string(),
  githubLogin: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;

// --- Repositories ---

export const RepositoryListItemSchema = z.object({
  githubRepoId: z.number(),
  owner: z.string(),
  name: z.string(),
  fullName: z.string(),
  defaultBranch: z.string(),
  private: z.boolean(),
  isConnected: z.boolean(),
  internalId: z.string().nullable(),
});
export type RepositoryListItem = z.infer<typeof RepositoryListItemSchema>;

export const ConnectRepositoryRequestSchema = z.object({
  githubRepoId: z.number(),
  owner: z.string().min(1),
  name: z.string().min(1),
  fullName: z.string().min(1),
  defaultBranch: z.string().min(1),
  private: z.boolean(),
});
export type ConnectRepositoryRequest = z.infer<typeof ConnectRepositoryRequestSchema>;

export const RepositoryDetailSchema = z.object({
  id: z.string(),
  owner: z.string(),
  name: z.string(),
  fullName: z.string(),
  defaultBranch: z.string(),
  private: z.boolean(),
});
export type RepositoryDetail = z.infer<typeof RepositoryDetailSchema>;

export const BranchSummarySchema = z.object({
  name: z.string(),
  commitSha: z.string(),
  protected: z.boolean(),
});
export type BranchSummary = z.infer<typeof BranchSummarySchema>;

export const CompareSummarySchema = z.object({
  aheadBy: z.number(),
  behindBy: z.number(),
  totalCommits: z.number(),
  files: z.array(
    z.object({
      path: z.string(),
      status: FileChangeStatus,
      additions: z.number(),
      deletions: z.number(),
    }),
  ),
});
export type CompareSummary = z.infer<typeof CompareSummarySchema>;

// --- Architecture ---

export const ArchitecturePatternSchema = z.object({
  name: z.string(),
  detected: z.boolean(),
  evidencePaths: z.array(z.string()),
});
export type ArchitecturePattern = z.infer<typeof ArchitecturePatternSchema>;

export const ArchitectureSnapshotDtoSchema = z.object({
  id: z.string(),
  repositoryId: z.string(),
  commitSha: z.string(),
  language: z.string().nullable(),
  framework: z.string().nullable(),
  packageManager: z.string().nullable(),
  entryPoints: z.array(z.string()),
  layering: z.array(z.string()),
  structure: z.unknown(),
  patterns: z.array(ArchitecturePatternSchema),
  conventions: z.unknown(),
  confidence: ArchitectureConfidence,
  createdAt: z.string(),
});
export type ArchitectureSnapshotDto = z.infer<typeof ArchitectureSnapshotDtoSchema>;

// --- Reviews ---

export const CreateReviewRequestSchema = z
  .object({
    repositoryId: z.string().min(1),
    baseBranch: z.string().min(1).optional(),
    headBranch: z.string().min(1),
    /** Review the entire branch as one diff (against git's empty tree) instead of against a base branch. */
    wholeBranch: z.boolean().optional(),
  })
  .refine((data) => !(data.wholeBranch && data.baseBranch), {
    message: 'baseBranch cannot be set when wholeBranch is true',
    path: ['baseBranch'],
  });
export type CreateReviewRequest = z.infer<typeof CreateReviewRequestSchema>;

export const ReviewSummaryDtoSchema = z.object({
  id: z.string(),
  repositoryFullName: z.string(),
  baseBranch: z.string(),
  headBranch: z.string(),
  status: ReviewStatus,
  score: z.number().nullable(),
  issueCount: z.number(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type ReviewSummaryDto = z.infer<typeof ReviewSummaryDtoSchema>;

export const ReviewDetailDtoSchema = z.object({
  id: z.string(),
  repositoryId: z.string(),
  repositoryFullName: z.string(),
  baseBranch: z.string(),
  headBranch: z.string(),
  baseSha: z.string().nullable(),
  headSha: z.string().nullable(),
  status: ReviewStatus,
  summary: z.string().nullable(),
  score: z.number().nullable(),
  architectureScore: z.number().nullable(),
  securityScore: z.number().nullable(),
  qualityScore: z.number().nullable(),
  performanceScore: z.number().nullable(),
  testingScore: z.number().nullable(),
  model: z.string().nullable(),
  inputTokens: z.number().nullable(),
  outputTokens: z.number().nullable(),
  estimatedCostUsd: z.number().nullable(),
  errorMessage: z.string().nullable(),
  githubCommentId: z.number().nullable(),
  githubCommentUrl: z.string().nullable(),
  githubCommentTarget: GithubCommentTarget.nullable(),
  githubCommentPostedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
});
export type ReviewDetailDto = z.infer<typeof ReviewDetailDtoSchema>;

export const PostReviewCommentResponseSchema = z.object({
  githubCommentId: z.number(),
  githubCommentUrl: z.string(),
  githubCommentTarget: GithubCommentTarget,
  githubCommentPostedAt: z.string(),
});
export type PostReviewCommentResponse = z.infer<typeof PostReviewCommentResponseSchema>;

export const ReviewIssueDtoSchema = z.object({
  id: z.string(),
  severity: IssueSeverity,
  category: IssueCategory,
  file: z.string().nullable(),
  line: z.number().nullable(),
  title: z.string(),
  message: z.string(),
  reason: z.string(),
  suggestion: z.string(),
});
export type ReviewIssueDto = z.infer<typeof ReviewIssueDtoSchema>;

export const ReviewFileDtoSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  status: FileChangeStatus,
  additions: z.number(),
  deletions: z.number(),
  patch: z.string().nullable(),
});
export type ReviewFileDto = z.infer<typeof ReviewFileDtoSchema>;

// --- Settings ---

export const ReviewSettingDtoSchema = z.object({
  excludedPatterns: z.array(z.string()),
  maxFiles: z.number().int().positive(),
  maxFileSizeKb: z.number().int().positive(),
  maxContextTokens: z.number().int().positive(),
  model: z.string(),
});
export type ReviewSettingDto = z.infer<typeof ReviewSettingDtoSchema>;

export const UpdateReviewSettingRequestSchema = ReviewSettingDtoSchema.partial();
export type UpdateReviewSettingRequest = z.infer<typeof UpdateReviewSettingRequestSchema>;

// --- Generic API envelope ---

export const ApiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
