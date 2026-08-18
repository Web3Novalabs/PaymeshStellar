/**
 * CLI migration runner.
 *
 * Usage (after `pnpm build`):
 *   node dist/db/migrate.js        # run all *_up.sql migrations
 *   node dist/db/migrate.js down   # run all *_down.sql migrations
 *
 * Or via pnpm scripts:
 *   pnpm --filter backend db:migrate
 *   pnpm --filter backend db:migrate:down
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

// When compiled to dist/db/migrate.js the SQL files live two levels up at
// src/db/migrations relative to the backend root.
const migrationsDir = resolve(__dirname, '../../src/db/migrations');

async function runMigrations(direction: 'up' | 'down'): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }

  const pool = new Pool({ connectionString });

  try {
    const suffix = `_${direction}.sql`;
    let files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(suffix))
      .sort();

    if (direction === 'down') {
      files = files.reverse();
    }

    if (files.length === 0) {
      console.log(`No ${direction} migration files found in ${migrationsDir}`);
      return;
    }

    for (const file of files) {
      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, 'utf8');
      console.log(`Running ${file} ...`);
      await pool.query(sql);
      console.log(`  ✓ ${file}`);
    }

    console.log(`\nAll ${direction} migrations completed successfully.`);
  } finally {
    await pool.end();
  }
}

const direction: 'up' | 'down' = process.argv[2] === 'down' ? 'down' : 'up';

runMigrations(direction).catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
