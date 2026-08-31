import { Router } from 'express';
import { requireAuth } from './session.middleware.js';
import { githubCallback, githubLogin, logout, me } from './auth.controller.js';

export const authRouter = Router();

authRouter.get('/github', githubLogin);
authRouter.get('/github/callback', githubCallback);
authRouter.post('/logout', requireAuth, logout);
authRouter.get('/me', requireAuth, me);
