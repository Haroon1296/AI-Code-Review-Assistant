import type { ReviewSetting } from '@prisma/client';
import type { UpdateReviewSettingRequest } from '@acra/types';
import { prisma } from '../../db/prisma.js';
import { defaultExcludedPatterns, env } from '../../config/env.js';

export async function getOrCreateSettings(userId: string): Promise<ReviewSetting> {
  const existing = await prisma.reviewSetting.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.reviewSetting.create({
    data: {
      userId,
      excludedPatterns: defaultExcludedPatterns,
      maxFiles: env.MAX_CHANGED_FILES,
      maxFileSizeKb: env.MAX_FILE_SIZE_KB,
      maxContextTokens: env.MAX_CONTEXT_TOKENS,
      model: env.OPENAI_MODEL,
    },
  });
}

export async function updateSettings(
  userId: string,
  patch: UpdateReviewSettingRequest,
): Promise<ReviewSetting> {
  await getOrCreateSettings(userId);
  return prisma.reviewSetting.update({ where: { userId }, data: patch });
}
