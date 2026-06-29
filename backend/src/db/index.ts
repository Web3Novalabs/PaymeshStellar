import { Pool } from 'pg';
import type { QueryResult, QueryResultRow } from 'pg';

/**
 * Shared connection pool.  Connection string is read from DATABASE_URL;
 * set that env var before importing this module in production.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Execute a parameterised SQL statement against the shared pool.
 * Generic T is the shape of each returned row.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(sql, values);
}
