import { Request, Response, NextFunction } from 'express';
import { query } from '../db/index.js';

export const idempotency = async (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'POST') {
    return next();
  }

  const key = req.headers['idempotency-key'] as string | undefined;
  if (!key) {
    return next();
  }

  try {
    // Check if key exists
    const existingRes = await query(
      'SELECT status, response_body FROM idempotency_keys WHERE id = $1',
      [key]
    );

    if (existingRes.rowCount && existingRes.rowCount > 0) {
      const record = existingRes.rows[0];
      if (record.status === 'completed') {
        // Return saved response
        return res.status(200).json(record.response_body);
      } else {
        // Processing or failed, return 409
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A request with this idempotency key is already processing.',
          },
        });
      }
    }

    // Insert new key as processing
    await query("INSERT INTO idempotency_keys (id, status) VALUES ($1, 'processing')", [key]);

    // Wrap res.json to capture response
    const originalJson = res.json;
    res.json = function (body: unknown) {
      // Restore original json to avoid double-calling issues
      res.json = originalJson;

      // We don't block the response to the user on this DB update
      query("UPDATE idempotency_keys SET status = 'completed', response_body = $1 WHERE id = $2", [
        body,
        key,
      ]).catch((err) => {
        console.error('Failed to update idempotency key:', err);
      });

      return originalJson.call(this, body);
    };

    next();
  } catch (error) {
    console.error('Idempotency error:', error);
    next(error);
  }
};
