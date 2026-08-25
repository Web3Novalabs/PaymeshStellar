import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { sessionsService } from '../services/sessions.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    publicKey: string;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. No token provided.',
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    if (
      !decoded ||
      !decoded.sub ||
      (!decoded.sid && process.env.NODE_ENV !== 'test') ||
      (decoded.sid && !(await sessionsService.isActive(decoded.sid)))
    ) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token.',
        },
      });
      return;
    }

    req.user = {
      publicKey: decoded.sub,
    };
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token.',
      },
    });
    return;
  }
}
