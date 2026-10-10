import { describe, expect, it } from 'vitest';
import { isGithubNotFoundError, mapGithubCommentError } from './github-comment-error.js';

describe('mapGithubCommentError', () => {
  it('maps 401 to GITHUB_TOKEN_INVALID', () => {
    expect(mapGithubCommentError({ status: 401 })).toMatchObject({
      statusCode: 401,
      code: 'GITHUB_TOKEN_INVALID',
    });
  });

  it('maps 403 without a rate-limit header to GITHUB_FORBIDDEN', () => {
    expect(mapGithubCommentError({ status: 403 })).toMatchObject({
      statusCode: 403,
      code: 'GITHUB_FORBIDDEN',
    });
  });

  it('maps 403 with X-RateLimit-Remaining: 0 to GITHUB_RATE_LIMITED', () => {
    const err = { status: 403, response: { headers: { 'x-ratelimit-remaining': '0' } } };
    expect(mapGithubCommentError(err)).toMatchObject({
      statusCode: 429,
      code: 'GITHUB_RATE_LIMITED',
    });
  });

  it('maps a secondary rate limit (403, quota left, retry-after) to GITHUB_RATE_LIMITED, not FORBIDDEN', () => {
    const err = {
      status: 403,
      message: 'You have exceeded a secondary rate limit',
      response: { headers: { 'x-ratelimit-remaining': '4321', 'retry-after': '60' } },
    };
    expect(mapGithubCommentError(err)).toMatchObject({
      statusCode: 429,
      code: 'GITHUB_RATE_LIMITED',
    });
  });

  it('maps a secondary rate limit reported as 429 to GITHUB_RATE_LIMITED', () => {
    const err = { status: 429, message: 'You have exceeded a secondary rate limit' };
    expect(mapGithubCommentError(err)).toMatchObject({
      statusCode: 429,
      code: 'GITHUB_RATE_LIMITED',
    });
  });

  it('maps 404 to GITHUB_NOT_FOUND', () => {
    expect(mapGithubCommentError({ status: 404 })).toMatchObject({
      statusCode: 404,
      code: 'GITHUB_NOT_FOUND',
    });
  });

  it('maps anything else, including non-Octokit errors, to GITHUB_COMMENT_FAILED', () => {
    expect(mapGithubCommentError({ status: 500 })).toMatchObject({
      statusCode: 502,
      code: 'GITHUB_COMMENT_FAILED',
    });
    expect(mapGithubCommentError(new Error('boom'))).toMatchObject({
      statusCode: 502,
      code: 'GITHUB_COMMENT_FAILED',
    });
  });
});

describe('isGithubNotFoundError', () => {
  it('is true only for a 404 status', () => {
    expect(isGithubNotFoundError({ status: 404 })).toBe(true);
    expect(isGithubNotFoundError({ status: 403 })).toBe(false);
    expect(isGithubNotFoundError(new Error('boom'))).toBe(false);
  });
});
