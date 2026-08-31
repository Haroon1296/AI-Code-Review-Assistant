import { Router } from 'express';
import { z } from 'zod';
import { ConnectRepositoryRequestSchema } from '@acra/types';
import { requireAuth } from '../auth/session.middleware.js';
import { validate } from '../../common/validate.js';
import {
  getRepository,
  getRepositoryArchitecture,
  getRepositoryBranches,
  getRepositoryCompare,
  listRepositories,
  postConnectRepository,
} from './repositories.controller.js';

const compareQuerySchema = z.object({ base: z.string().min(1), head: z.string().min(1) });
const architectureQuerySchema = z.object({ branch: z.string().min(1) });

export const repositoriesRouter = Router();

repositoriesRouter.use(requireAuth);

repositoriesRouter.get('/', listRepositories);
repositoriesRouter.post('/', validate(ConnectRepositoryRequestSchema), postConnectRepository);
repositoriesRouter.get('/:id', getRepository);
repositoriesRouter.get('/:id/branches', getRepositoryBranches);
repositoriesRouter.get('/:id/compare', validate(compareQuerySchema, 'query'), getRepositoryCompare);
repositoriesRouter.get(
  '/:id/architecture',
  validate(architectureQuerySchema, 'query'),
  getRepositoryArchitecture,
);
