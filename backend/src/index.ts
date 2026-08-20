import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import groupsRouter from './routes/groups.js';
import transactionsRouter from './routes/transactions.js';
import { asyncHandler } from './middleware/asyncHandler.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import usersRouter from './routes/users.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import { authConfig, validateAuthEnvironment } from './config/auth.js';
import { challengesService } from './services/challenges.js';
import { sessionsService } from './services/sessions.js';
import { reconciliationService } from './services/reconcile.js';
import { idempotency } from './middleware/idempotency.js';
import { apiLimiter } from './middleware/rateLimiter.js';

dotenv.config();
validateAuthEnvironment();

if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  throw new Error('CORS_ORIGIN must be set in production');
}

const app: Express = express();
const port = process.env.PORT || 3001;
const startTime = Date.now();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '50kb' }));
app.use(requestLogger);

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Welcome to PaymeshStellar Backend API' });
});

app.get('/health', (_req: Request, res: Response) => {
  const reconcileHealth = reconciliationService.getHealth();
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version ?? '0.1.0',
    reconciliation: {
      lastRunTime: reconcileHealth.lastRunTime,
      currentDriftCount: reconcileHealth.currentDriftCount,
    }
  });
});

if (process.env.NODE_ENV === 'test') {
  app.get(
    '/__test/error',
    asyncHandler(async () => {
      throw new Error('boom');
    })
  );
}

app.use('/auth', authRouter);

// Apply rate limiting and idempotency to API routes
app.use('/api', apiLimiter);
app.use('/api', idempotency);

app.use('/api/admin', adminRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/users', usersRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };

if (process.env.NODE_ENV !== 'test') {
  const cleanupTimer = setInterval(() => {
    Promise.all([challengesService.cleanup(), sessionsService.cleanup()]).catch(
      (error: unknown) => {
        console.error('Authentication cleanup failed:', error);
      }
    );
  }, authConfig().cleanupIntervalSeconds * 1000);
  cleanupTimer.unref();

  const RECONCILE_INTERVAL_MS = parseInt(process.env.RECONCILE_INTERVAL_MS || '3600000', 10);
  const reconcileTimer = setInterval(() => {
    reconciliationService.reconcileAll().catch((error: unknown) => {
      console.error('Scheduled reconciliation failed:', error);
    });
  }, RECONCILE_INTERVAL_MS);
  reconcileTimer.unref();

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
