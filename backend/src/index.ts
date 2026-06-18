import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import groupsRouter from './routes/groups.js';
import transactionsRouter from './routes/transactions.js';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Welcome to PaymeshStellar Backend API' });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/api/groups', groupsRouter);
app.use('/api/transactions', transactionsRouter);

// Export app for integration tests
export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
