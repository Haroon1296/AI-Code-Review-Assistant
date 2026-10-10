import {
  AppError,
  forbidden,
  notFound,
  tooManyRequests,
  unauthorized,
} from '../../common/errors.js';

interface OctokitLikeError {
  status?: number;
  message?: string;
  response?: { headers?: Record<string, string> };
}

function isOctokitError(err: unknown): err is OctokitLikeError {
  return typeof err === 'object' && err !== null && 'status' in err;
}

/**
 * GitHub signals two different kinds of throttling: the primary hourly limit
 * (`x-ratelimit-remaining: 0`) and the secondary/abuse limit, which keeps a
 * non-zero remaining count and instead sends `retry-after` and says so in the
 * message. Both are "wait and retry", not "fix your permissions".
 */
function isRateLimited(err: OctokitLikeError): boolean {
  const headers = err.response?.headers ?? {};
  return (
    headers['x-ratelimit-remaining'] === '0' ||
    headers['retry-after'] !== undefined ||
    /secondary rate limit|abuse detection/i.test(err.message ?? '')
  );
}

export function isGithubNotFoundError(err: unknown): boolean {
  return isOctokitError(err) && err.status === 404;
}

/** Maps a GitHub API failure (from posting/updating a comment) to this app's AppError conventions. */
export function mapGithubCommentError(err: unknown): AppError {
  if (!isOctokitError(err)) {
    return new AppError(502, 'Failed to post the comment to GitHub', 'GITHUB_COMMENT_FAILED');
  }

  switch (err.status) {
    case 401:
      return unauthorized(
        'Your GitHub connection has expired — please reconnect your account',
        'GITHUB_TOKEN_INVALID',
      );
    case 429:
    case 403: {
      if (isRateLimited(err)) {
        return tooManyRequests(
          'GitHub API rate limit reached — try again later',
          'GITHUB_RATE_LIMITED',
        );
      }
      return forbidden(
        'You do not have permission to comment on this repository',
        'GITHUB_FORBIDDEN',
      );
    }
    case 404:
      return notFound(
        'The commit or pull request this review targeted no longer exists on GitHub',
        'GITHUB_NOT_FOUND',
      );
    default:
      return new AppError(502, 'Failed to post the comment to GitHub', 'GITHUB_COMMENT_FAILED');
  }
}
