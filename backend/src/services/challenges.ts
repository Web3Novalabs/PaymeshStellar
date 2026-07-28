import crypto from 'crypto';

export interface Challenge {
  nonce: string;
  address: string;
  message: string;
  expiresAt: Date;
  used: boolean;
}

export interface ChallengesService {
  create(address: string): Promise<Challenge>;
  /** Consumes the challenge for (address, nonce) if valid, unexpired, and unused. Returns null otherwise. */
  consume(address: string, nonce: string): Promise<Challenge | null>;
  clear(): Promise<void>; // utility for tests
}

const CHALLENGE_TTL_SECONDS = Number(process.env.CHALLENGE_TTL_SECONDS) || 5 * 60;

export function buildChallengeMessage(address: string, nonce: string, issuedAt: string): string {
  return `PaymeshStellar authentication request\naddress: ${address}\nnonce: ${nonce}\nissued at: ${issuedAt}`;
}

export class InMemoryChallengesService implements ChallengesService {
  private challenges = new Map<string, Challenge>();

  private key(address: string, nonce: string): string {
    return `${address}:${nonce}`;
  }

  async create(address: string): Promise<Challenge> {
    const nonce = crypto.randomBytes(16).toString('hex');
    const issuedAt = new Date().toISOString();
    const challenge: Challenge = {
      nonce,
      address,
      message: buildChallengeMessage(address, nonce, issuedAt),
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000),
      used: false,
    };
    this.challenges.set(this.key(address, nonce), challenge);
    return challenge;
  }

  async consume(address: string, nonce: string): Promise<Challenge | null> {
    const key = this.key(address, nonce);
    const challenge = this.challenges.get(key);
    if (!challenge) return null;
    if (challenge.used || challenge.expiresAt.getTime() < Date.now()) {
      return null;
    }
    challenge.used = true;
    this.challenges.set(key, challenge);
    return challenge;
  }

  async clear(): Promise<void> {
    this.challenges.clear();
  }
}

export const challengesService: ChallengesService = new InMemoryChallengesService();
