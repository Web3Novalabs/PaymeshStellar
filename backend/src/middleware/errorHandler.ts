import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from './logger.js';
import { AppError } from '../errors/AppError.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'Not Found'));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId =
    (res.getHeader('x-request-id') as string | undefined) ||
    (req.headers['x-request-id'] as string | undefined) ||
    'unknown';

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.publicMessage : 'An unexpected error occurred.';

  logger.error(
    {
      err,
      requestId,
      statusCode,
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
    },
    'error response'
  );

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId,
    },
  });
};
