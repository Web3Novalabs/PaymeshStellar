import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate =
  (schema: ZodSchema<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const zodError = error as any;
        const message = (zodError.errors || zodError.issues)
          .map((err: any) => `${err.path.join('.')} - ${err.message}`)
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
