/**
 * Applies the project's real migration files (src/db/migrations/*.sql)
 * against a given pool — used by tests that need a fully migrated schema
 * (indexer_cursor plus the tables it references) rather than a hand-inlined
 * copy of the SQL. Not a test file itself.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/db/__tests__/migrationHelper.js -> backend root -> src/db/migrations
const migrationsDir = resolve(__dirname, '../../../src/db/migrations');

function migrationFiles(direction: 'up' | 'down'): string[] {
  const suffix = `_${direction}.sql`;
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(suffix))
    .sort();
  return direction === 'down' ? files.reverse() : files;
}

export async function applyMigrations(pool: Pool, direction: 'up' | 'down'): Promise<void> {
  for (const file of migrationFiles(direction)) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    await pool.query(sql);
  }
}

export function listMigrationFiles(direction: 'up' | 'down'): string[] {
  return migrationFiles(direction);
}
