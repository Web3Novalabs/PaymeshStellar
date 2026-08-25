import crypto from 'node:crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import { authConfig } from '../config/auth.js';
import { pool, query } from '../db/index.js';

export interface IssuedSession {
  id: string;
  familyId: string;
  publicKey: string;
  refreshToken: string;
  expiresAt: Date;
}

export type RotationResult =
  { status: 'ok'; session: IssuedSession } | { status: 'invalid' | 'expired' | 'reuse' };

export interface SessionsService {
  create(publicKey: string): Promise<IssuedSession>;
  rotate(refreshToken: string): Promise<RotationResult>;
  logout(refreshToken: string): Promise<boolean>;
  logoutAll(publicKey: string): Promise<void>;
  isActive(id: string): Promise<boolean>;
  cleanup(): Promise<number>;
  clear(): Promise<void>;
}

function tokenHash(token: string): Buffer {
  return crypto.createHash('sha256').update(token, 'utf8').digest();
}

function constantEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function token(): string {
  return crypto.randomBytes(32).toString('base64url');
}

interface SessionRow extends QueryResultRow {
  id: string;
  family_id: string;
  public_key: string;
  token_hash: Buffer;
  expires_at: Date;
  rotated_at: Date | null;
  revoked_at: Date | null;
}

async function insertSession(
  client: Pick<PoolClient, 'query'>,
  publicKey: string,
  familyId: string = crypto.randomUUID()
): Promise<IssuedSession> {
  const refreshToken = token();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + authConfig().refreshTtlSeconds * 1000);
  await client.query(
    `INSERT INTO auth_sessions (id, family_id, public_key, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, familyId, publicKey, tokenHash(refreshToken), expiresAt]
  );
  return { id, familyId, publicKey, refreshToken, expiresAt };
}

export class PostgresSessionsService implements SessionsService {
  async create(publicKey: string): Promise<IssuedSession> {
    return insertSession(pool, publicKey);
  }

  async rotate(refreshToken: string): Promise<RotationResult> {
    const hash = tokenHash(refreshToken);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<SessionRow>(
        `SELECT id, family_id, public_key, token_hash, expires_at, rotated_at, revoked_at
         FROM auth_sessions WHERE token_hash = $1 FOR UPDATE`,
        [hash]
      );
      const current = result.rows[0];
      if (!current || !constantEqual(current.token_hash, hash)) {
        await client.query('COMMIT');
        return { status: 'invalid' };
      }
      if (current.rotated_at || current.revoked_at) {
        await client.query(
          'UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE family_id = $1',
          [current.family_id]
        );
        await client.query(
          `INSERT INTO auth_security_events (event_type, family_id, public_key, metadata)
           VALUES ('refresh_token_reuse', $1, $2, $3)`,
          [current.family_id, current.public_key, JSON.stringify({ sessionId: current.id })]
        );
        await client.query('COMMIT');
        return { status: 'reuse' };
      }
      if (current.expires_at.getTime() <= Date.now()) {
        await client.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1', [
          current.id,
        ]);
        await client.query('COMMIT');
        return { status: 'expired' };
      }
      const next = await insertSession(client, current.public_key, current.family_id);
      await client.query(
        'UPDATE auth_sessions SET rotated_at = NOW(), replaced_by = $2 WHERE id = $1',
        [current.id, next.id]
      );
      await client.query('COMMIT');
      return { status: 'ok', session: next };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async logout(refreshToken: string): Promise<boolean> {
    const hash = tokenHash(refreshToken);
    const result = await query<SessionRow>(
      `UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE token_hash = $1 RETURNING id, family_id, public_key, token_hash,
       expires_at, rotated_at, revoked_at`,
      [hash]
    );
    const row = result.rows[0];
    return Boolean(row && constantEqual(row.token_hash, hash));
  }

  async logoutAll(publicKey: string): Promise<void> {
    await query(
      `UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE public_key = $1 AND revoked_at IS NULL`,
      [publicKey]
    );
  }

  async isActive(id: string): Promise<boolean> {
    const result = await query<{ active: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM auth_sessions
         WHERE id = $1 AND revoked_at IS NULL AND rotated_at IS NULL AND expires_at > NOW()
       ) AS active`,
      [id]
    );
    return result.rows[0]?.active ?? false;
  }

  async cleanup(): Promise<number> {
    const result = await query(
      "DELETE FROM auth_sessions WHERE expires_at < NOW() - INTERVAL '30 days'"
    );
    return result.rowCount ?? 0;
  }

  async clear(): Promise<void> {
    await query('DELETE FROM auth_security_events');
    await query('DELETE FROM auth_sessions');
  }
}

interface MemorySession extends IssuedSession {
  hash: Buffer;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

export class InMemorySessionsService implements SessionsService {
  private readonly sessions = new Map<string, MemorySession>();

  async create(publicKey: string, familyId: string = crypto.randomUUID()): Promise<IssuedSession> {
    const refreshToken = token();
    const session: MemorySession = {
      id: crypto.randomUUID(),
      familyId,
      publicKey,
      refreshToken,
      expiresAt: new Date(Date.now() + authConfig().refreshTtlSeconds * 1000),
      hash: tokenHash(refreshToken),
      rotatedAt: null,
      revokedAt: null,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  private find(refreshToken: string): MemorySession | undefined {
    const hash = tokenHash(refreshToken);
    return [...this.sessions.values()].find((session) => constantEqual(session.hash, hash));
  }

  async rotate(refreshToken: string): Promise<RotationResult> {
    const current = this.find(refreshToken);
    if (!current) return { status: 'invalid' };
    if (current.rotatedAt || current.revokedAt) {
      for (const session of this.sessions.values()) {
        if (session.familyId === current.familyId) session.revokedAt ??= new Date();
      }
      return { status: 'reuse' };
    }
    if (current.expiresAt.getTime() <= Date.now()) {
      current.revokedAt = new Date();
      return { status: 'expired' };
    }
    current.rotatedAt = new Date();
    return { status: 'ok', session: await this.create(current.publicKey, current.familyId) };
  }

  async logout(refreshToken: string): Promise<boolean> {
    const session = this.find(refreshToken);
    if (!session) return false;
    session.revokedAt ??= new Date();
    return true;
  }

  async logoutAll(publicKey: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.publicKey === publicKey) session.revokedAt ??= new Date();
    }
  }

  async isActive(id: string): Promise<boolean> {
    const session = this.sessions.get(id);
    return Boolean(
      session &&
      !session.revokedAt &&
      !session.rotatedAt &&
      session.expiresAt.getTime() > Date.now()
    );
  }

  async cleanup(): Promise<number> {
    let deleted = 0;
    for (const [id, session] of this.sessions) {
      if (session.expiresAt.getTime() < Date.now() - 30 * 86_400_000) {
        this.sessions.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  async clear(): Promise<void> {
    this.sessions.clear();
  }
}

export const sessionsService: SessionsService =
  process.env.NODE_ENV === 'test' ? new InMemorySessionsService() : new PostgresSessionsService();
