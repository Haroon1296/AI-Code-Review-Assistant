import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { decryptSecret, encryptSecret, generateSessionId } from '../../common/crypto.js';
import { exchangeCodeForAccessToken, GithubService } from '../github/github.service.js';
import type { AuthenticatedUser } from './auth.types.js';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';

export function generateOAuthState(): string {
  return randomBytes(16).toString('hex');
}

export function buildGithubAuthorizeUrl(state: string): string {
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${apiBaseUrl()}/api/auth/github/callback`);
  url.searchParams.set('scope', env.GITHUB_OAUTH_SCOPES.split(',').join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('allow_signup', 'true');
  return url.toString();
}

function apiBaseUrl(): string {
  return `http://localhost:${env.API_PORT}`;
}

export interface OAuthCallbackResult {
  sessionId: string;
  user: AuthenticatedUser;
}

/** Exchanges the OAuth code, upserts the user with an encrypted token, and opens a new session. */
export async function completeGithubOAuth(code: string): Promise<OAuthCallbackResult> {
  const accessToken = await exchangeCodeForAccessToken(code);
  const github = new GithubService(accessToken);
  const githubUser = await github.getAuthenticatedUser();
  const encrypted = encryptSecret(accessToken);

  const user = await prisma.user.upsert({
    where: { githubId: githubUser.id },
    update: {
      githubLogin: githubUser.login,
      name: githubUser.name,
      avatarUrl: githubUser.avatar_url,
      email: githubUser.email,
      encryptedAccessToken: encrypted.ciphertext,
      tokenIv: encrypted.iv,
      tokenAuthTag: encrypted.authTag,
    },
    create: {
      githubId: githubUser.id,
      githubLogin: githubUser.login,
      name: githubUser.name,
      avatarUrl: githubUser.avatar_url,
      email: githubUser.email,
      encryptedAccessToken: encrypted.ciphertext,
      tokenIv: encrypted.iv,
      tokenAuthTag: encrypted.authTag,
    },
  });

  const session = await prisma.session.create({
    data: {
      id: generateSessionId(),
      userId: user.id,
      expiresAt: new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000),
    },
  });

  return {
    sessionId: session.id,
    user: {
      id: user.id,
      githubId: user.githubId,
      githubLogin: user.githubLogin,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
  };
}

export async function destroySession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

/** Decrypts a user's GitHub access token for making authenticated GitHub calls. Never returned in API responses. */
export async function getDecryptedAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return decryptSecret({
    ciphertext: user.encryptedAccessToken,
    iv: user.tokenIv,
    authTag: user.tokenAuthTag,
  });
}

export async function createGithubServiceForUser(userId: string): Promise<GithubService> {
  const token = await getDecryptedAccessToken(userId);
  return new GithubService(token);
}
