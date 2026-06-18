import pino from 'pino';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const env = process.env.NODE_ENV ?? 'development';
const level = process.env.LOG_LEVEL ?? (env === 'production' ? 'info' : 'debug');

export const logger = pino({
  level,
  transport:
    env !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.headers["x-auth-token"]',
      'req.headers["x-access-token"]',
      'req.headers["x-amz-security-token"]',
      'req.headers["x-forwarded-secret"]',
      'req.headers["x-signature"]',
      'req.headers["x-api-signature"]',
      'req.headers["x-user-password"]',
    ],
    censor: '[redacted]',
  },
});

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = String(req.headers['x-request-id'] ?? randomUUID());
  res.setHeader('x-request-id', requestId);

  const start = process.hrtime.bigint();
  const log = logger.child({ requestId, method: req.method, path: req.path });

  log.info({ params: req.params, query: req.query }, 'incoming request');

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    log.info(
      {
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(3)),
        contentLength: res.getHeader('content-length'),
        params: req.params,
        query: req.query,
      },
      'request completed'
    );
  });

  next();
}
