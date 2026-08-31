import type { Request, Response } from 'express';
import type { ReviewSettingDto } from '@acra/types';
import { asyncHandler } from '../../common/async-handler.js';
import { getOrCreateSettings, updateSettings } from './settings.service.js';

function toDto(setting: Awaited<ReturnType<typeof getOrCreateSettings>>): ReviewSettingDto {
  return {
    excludedPatterns: setting.excludedPatterns,
    maxFiles: setting.maxFiles,
    maxFileSizeKb: setting.maxFileSizeKb,
    maxContextTokens: setting.maxContextTokens,
    model: setting.model,
  };
}

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getOrCreateSettings(req.user!.id);
  res.json(toDto(settings));
});

export const putSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await updateSettings(req.user!.id, req.body);
  res.json(toDto(settings));
});
