import crypto from 'node:crypto';
import { Horizon, TransactionBuilder, WebAuth } from '@stellar/stellar-sdk';
import { authConfig } from '../config/auth.js';
import type { Challenge } from './challenges.js';

export interface AuthenticationAccount {
  mediumThreshold: number;
  signers: Horizon.ServerApi.AccountRecordSigners[];
}

export interface AccountAuthService {
  load(publicKey: string): Promise<AuthenticationAccount>;
}

class HorizonAccountAuthService implements AccountAuthService {
  private readonly server = new Horizon.Server(
    process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org'
  );

  async load(publicKey: string): Promise<AuthenticationAccount> {
    const account = await this.server.loadAccount(publicKey);
    return {
      mediumThreshold: account.thresholds.med_threshold,
      signers: account.signers,
    };
  }
}

export const accountAuthService: AccountAuthService = new HorizonAccountAuthService();

function equalSecret(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function verifySep10Challenge(
  signedTransaction: string,
  challenge: Challenge
): Promise<string> {
  const config = authConfig();
  const { tx, clientAccountID } = WebAuth.readChallengeTx(
    signedTransaction,
    config.signingKeypair.publicKey(),
    config.networkPassphrase,
    config.homeDomain,
    config.webAuthDomain
  );

  if (clientAccountID !== challenge.address) throw new Error('Client account does not match');
  if (!equalSecret(Buffer.from(tx.hash()), challenge.transactionHash)) {
    throw new Error('Challenge transaction was modified');
  }

  const operation = tx.operations[0];
  if (!operation || operation.type !== 'manageData' || !operation.value) {
    throw new Error('Challenge nonce is missing');
  }
  const transactionNonce = operation.value.toString('utf8');
  if (!equalSecret(Buffer.from(transactionNonce), Buffer.from(challenge.nonce))) {
    throw new Error('Challenge nonce does not match');
  }

  const account = await accountAuthService.load(clientAccountID);
  WebAuth.verifyChallengeTxThreshold(
    signedTransaction,
    config.signingKeypair.publicKey(),
    config.networkPassphrase,
    account.mediumThreshold,
    account.signers,
    config.homeDomain,
    config.webAuthDomain
  );

  // Ensure parsing this exact envelope succeeds after threshold verification too.
  TransactionBuilder.fromXDR(signedTransaction, config.networkPassphrase);
  return clientAccountID;
}
