export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'APP_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST') =>
  new AppError(400, message, code);
export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') =>
  new AppError(401, message, code);
export const forbidden = (message = 'Not allowed', code = 'FORBIDDEN') =>
  new AppError(403, message, code);
export const notFound = (message = 'Not found', code = 'NOT_FOUND') =>
  new AppError(404, message, code);
export const tooManyRequests = (message = 'Too many requests', code = 'RATE_LIMITED') =>
  new AppError(429, message, code);
