import crypto from 'node:crypto';
import { TransactionBuilder, WebAuth } from '@stellar/stellar-sdk';
import type { QueryResultRow } from 'pg';
import { authConfig } from '../config/auth.js';
import { query } from '../db/index.js';

export interface Challenge {
  id: string;
  nonce: string;
  address: string;
  transaction: string;
  transactionHash: Buffer;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface ChallengesService {
  create(address: string): Promise<Challenge>;
  find(nonce: string): Promise<Challenge | null>;
  consume(id: string): Promise<boolean>;
  cleanup(): Promise<number>;
  clear(): Promise<void>;
}

function sha256(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function extractNonce(transaction: string): string {
  const config = authConfig();
  const tx = TransactionBuilder.fromXDR(transaction, config.networkPassphrase);
  const operation = tx.operations[0];
  if (!operation || operation.type !== 'manageData' || !operation.value) {
    throw new Error('Generated SEP-10 challenge is missing its nonce');
  }
  return operation.value.toString('utf8');
}

function newChallenge(address: string): Challenge {
  const config = authConfig();
  const transaction = WebAuth.buildChallengeTx(
    config.signingKeypair,
    address,
    config.homeDomain,
    config.challengeTtlSeconds,
    config.networkPassphrase,
    config.webAuthDomain
  );
  const tx = TransactionBuilder.fromXDR(transaction, config.networkPassphrase);
  return {
    id: crypto.randomUUID(),
    nonce: extractNonce(transaction),
    address,
    transaction,
    transactionHash: Buffer.from(tx.hash()),
    expiresAt: new Date(Date.now() + config.challengeTtlSeconds * 1000),
    usedAt: null,
  };
}

interface ChallengeRow extends QueryResultRow {
  id: string;
  nonce: string;
  wallet_address: string;
  transaction_xdr: string;
  transaction_hash: Buffer;
  expires_at: Date;
  used_at: Date | null;
}

function fromRow(row: ChallengeRow): Challenge {
  return {
    id: row.id,
    nonce: row.nonce,
    address: row.wallet_address,
    transaction: row.transaction_xdr,
    transactionHash: row.transaction_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
  };
}

export class PostgresChallengesService implements ChallengesService {
  async create(address: string): Promise<Challenge> {
    const challenge = newChallenge(address);
    await query(
      `INSERT INTO auth_challenges
       (id, nonce_hash, nonce, wallet_address, transaction_xdr, transaction_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        challenge.id,
        sha256(challenge.nonce),
        challenge.nonce,
        challenge.address,
        challenge.transaction,
        challenge.transactionHash,
        challenge.expiresAt,
      ]
    );
    return challenge;
  }

  async find(nonce: string): Promise<Challenge | null> {
    const result = await query<ChallengeRow>(
      `SELECT id, nonce, wallet_address, transaction_xdr, transaction_hash, expires_at, used_at
       FROM auth_challenges WHERE nonce_hash = $1 LIMIT 1`,
      [sha256(nonce)]
    );
    const row = result.rows[0];
    if (!row) return null;
    const stored = Buffer.from(row.nonce, 'utf8');
    const supplied = Buffer.from(nonce, 'utf8');
    if (stored.length !== supplied.length || !crypto.timingSafeEqual(stored, supplied)) return null;
    return fromRow(row);
  }

  async consume(id: string): Promise<boolean> {
    const result = await query(
      `UPDATE auth_challenges SET used_at = NOW()
       WHERE id = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [id]
    );
    return result.rowCount === 1;
  }

  async cleanup(): Promise<number> {
    const result = await query(
      "DELETE FROM auth_challenges WHERE expires_at < NOW() - INTERVAL '1 day'"
    );
    return result.rowCount ?? 0;
  }

  async clear(): Promise<void> {
    await query('DELETE FROM auth_challenges');
  }
}

export class InMemoryChallengesService implements ChallengesService {
  private readonly records = new Map<string, Challenge>();

  async create(address: string): Promise<Challenge> {
    const challenge = newChallenge(address);
    this.records.set(challenge.id, challenge);
    return challenge;
  }

  async find(nonce: string): Promise<Challenge | null> {
    const supplied = Buffer.from(nonce, 'utf8');
    for (const challenge of this.records.values()) {
      const stored = Buffer.from(challenge.nonce, 'utf8');
      if (stored.length === supplied.length && crypto.timingSafeEqual(stored, supplied)) {
        return challenge;
      }
    }
    return null;
  }

  async consume(id: string): Promise<boolean> {
    const challenge = this.records.get(id);
    if (!challenge || challenge.usedAt || challenge.expiresAt.getTime() <= Date.now()) return false;
    challenge.usedAt = new Date();
    return true;
  }

  async cleanup(): Promise<number> {
    let deleted = 0;
    for (const [id, challenge] of this.records) {
      if (challenge.expiresAt.getTime() < Date.now() - 86_400_000) {
        this.records.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

export const challengesService: ChallengesService =
  process.env.NODE_ENV === 'test'
    ? new InMemoryChallengesService()
    : new PostgresChallengesService();
