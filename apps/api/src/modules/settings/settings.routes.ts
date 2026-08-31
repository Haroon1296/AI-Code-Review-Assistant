import { Router } from 'express';
import { UpdateReviewSettingRequestSchema } from '@acra/types';
import { requireAuth } from '../auth/session.middleware.js';
import { validate } from '../../common/validate.js';
import { getSettings, putSettings } from './settings.controller.js';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);
settingsRouter.get('/', getSettings);
settingsRouter.put('/', validate(UpdateReviewSettingRequestSchema), putSettings);
