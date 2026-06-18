import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import groupsRouter from './routes/groups.js';
import transactionsRouter from './routes/transactions.js';
import { asyncHandler } from './middleware/asyncHandler.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import usersRouter from './routes/users.js';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

app.use(requestLogger);
app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Welcome to PaymeshStellar Backend API' });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
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
app.use(notFoundHandler);
app.use(errorHandler);
app.use('/api/transactions', transactionsRouter);
app.use('/api/users', usersRouter);

// Export app for integration tests
export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
