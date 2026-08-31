import type { ArchitectureSnapshot } from '@prisma/client';
import type { ArchitecturePattern, ArchitectureSnapshotDto } from '@acra/types';

export function toArchitectureSnapshotDto(snapshot: ArchitectureSnapshot): ArchitectureSnapshotDto {
  return {
    id: snapshot.id,
    repositoryId: snapshot.repositoryId,
    commitSha: snapshot.commitSha,
    language: snapshot.language,
    framework: snapshot.framework,
    packageManager: snapshot.packageManager,
    entryPoints: snapshot.entryPoints,
    layering: snapshot.layering,
    structure: snapshot.structureJson,
    patterns: snapshot.patternsJson as ArchitecturePattern[],
    conventions: snapshot.conventionsJson,
    confidence: snapshot.confidence,
    createdAt: snapshot.createdAt.toISOString(),
  };
}
