import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny, ZodIssue } from 'zod';

export const validate =
  (schema: ZodTypeAny) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed && typeof parsed === 'object') {
        const data = parsed as { body?: unknown; query?: unknown; params?: unknown };
        if (data.body !== undefined) req.body = data.body;
        if (data.query !== undefined) req.query = data.query as Request['query'];
        if (data.params !== undefined) req.params = data.params as Request['params'];
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues: ZodIssue[] =
          error.issues ?? (error as ZodError & { errors?: ZodIssue[] }).errors ?? [];
        const message = issues
          .map((err: ZodIssue) => `${err.path.join('.')} - ${err.message}`)
          .join(', ');

        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message,
          },
        });
      }
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid request data' },
      });
    }
  };
