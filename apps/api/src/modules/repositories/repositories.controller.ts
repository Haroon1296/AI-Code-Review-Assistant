import type { Request, Response } from 'express';
import type { RepositoryDetail } from '@acra/types';
import { asyncHandler } from '../../common/async-handler.js';
import {
  compareRepositoryBranches,
  connectRepository,
  listBranchesForRepository,
  listRepositoriesForUser,
  requireConnectedRepository,
} from './repositories.service.js';
import { getOrBuildArchitectureSnapshot } from '../analyzer/analyzer.service.js';
import { toArchitectureSnapshotDto } from '../analyzer/analyzer.mapper.js';

export const listRepositories = asyncHandler(async (req: Request, res: Response) => {
  const repos = await listRepositoriesForUser(req.user!.id);
  res.json(repos);
});

export const postConnectRepository = asyncHandler(async (req: Request, res: Response) => {
  const repository = await connectRepository(req.user!.id, req.body);
  const dto: RepositoryDetail = {
    id: repository.id,
    owner: repository.owner,
    name: repository.name,
    fullName: repository.fullName,
    defaultBranch: repository.defaultBranch,
    private: repository.private,
  };
  res.status(201).json(dto);
});

export const getRepository = asyncHandler(async (req: Request, res: Response) => {
  const repository = await requireConnectedRepository(req.user!.id, req.params.id as string);
  const dto: RepositoryDetail = {
    id: repository.id,
    owner: repository.owner,
    name: repository.name,
    fullName: repository.fullName,
    defaultBranch: repository.defaultBranch,
    private: repository.private,
  };
  res.json(dto);
});

export const getRepositoryBranches = asyncHandler(async (req: Request, res: Response) => {
  const branches = await listBranchesForRepository(req.user!.id, req.params.id as string);
  res.json(branches);
});

export const getRepositoryCompare = asyncHandler(async (req: Request, res: Response) => {
  const { base, head } = req.query as { base: string; head: string };
  const summary = await compareRepositoryBranches(req.user!.id, req.params.id as string, base, head);
  res.json(summary);
});

export const getRepositoryArchitecture = asyncHandler(async (req: Request, res: Response) => {
  const { branch } = req.query as { branch: string };
  const snapshot = await getOrBuildArchitectureSnapshot(req.user!.id, req.params.id as string, branch);
  res.json(toArchitectureSnapshotDto(snapshot));
});
