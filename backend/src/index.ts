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

dotenv.config();

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
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version ?? '0.1.0',
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

app.use('/api/groups', groupsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/users', usersRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
