import { Horizon, Networks, StrKey } from '@stellar/stellar-sdk';
import { HorizonError } from '../utils/errors.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Pagination options for Horizon queries.
 */
export interface PaginationOptions {
    cursor?: string;
    limit?: number;
    order?: 'asc' | 'desc';
}

/**
 * Typed balance information.
 */
export interface Balance {
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
    balance: string;
    limit?: string;
    buying_liabilities?: string;
    selling_liabilities?: string;
    last_modified_ledger?: number;
    is_authorized?: boolean;
}

/**
 * Typed account details.
 */
export interface AccountDetails {
    id: string;
    sequence: string;
    balances: Balance[];
    signers: Array<{
        key: string;
        weight: number;
        type: string;
    }>;
    flags: {
        auth_required: boolean;
        auth_revocable: boolean;
        auth_immutable: boolean;
        auth_clawback_enabled: boolean;
    };
}

/**
 * Service for interacting with Stellar Horizon API.
 */
export class HorizonService {
    private server: Horizon.Server;
    private networkPassphrase: string;
    private cache: Map<string, { data: unknown; timestamp: number }> = new Map();

    // Configuration from environment
    private readonly CACHE_TTL = parseInt(process.env.HORIZON_CACHE_TTL || '30000', 10);
    private readonly REQUEST_TIMEOUT = parseInt(process.env.HORIZON_TIMEOUT || '30000', 10);

    // Circuit Breaker State
    private circuitBreaker = {
        failures: 0,
        lastFailure: 0,
        threshold: 5,
        cooldown: 60000, // 1 minute
        isOpen: false
    };

    constructor() {
        const horizonUrl = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
        this.networkPassphrase = process.env.STELLAR_NETWORK || Networks.TESTNET;

        // Initialize Horizon server with custom timeout
        this.server = new Horizon.Server(horizonUrl, {
            allowHttp: horizonUrl.startsWith('http://'),
            appName: 'PaymeshBackend',
            appVersion: '1.0.0',
        });

        console.log(`[Horizon] Service initialized for network: ${this.networkPassphrase.substring(0, 15)}...`);
    }

    /**
     * Cryptographically validates a Stellar public key.
     */
    private validateAddress(address: string): void {
        if (!address || !StrKey.isValidEd25519PublicKey(address)) {
            console.error(`[Horizon] Invalid address detected: ${address}`);
            throw new HorizonError('Invalid Stellar address format', 400, 'INVALID_ADDRESS');
        }
    }

    /**
     * Checks if the circuit breaker is open.
     */
    private checkCircuit(): void {
        if (this.circuitBreaker.isOpen) {
            const now = Date.now();
            if (now - this.circuitBreaker.lastFailure > this.circuitBreaker.cooldown) {
                console.warn('[Horizon] Circuit breaker entering half-open state');
                this.circuitBreaker.isOpen = false;
                this.circuitBreaker.failures = 0;
            } else {
                throw new HorizonError('Horizon service temporarily unavailable (Circuit Open)', 503, 'SERVICE_UNAVAILABLE');
            }
        }
    }

    /**
     * Fetches account details with internal caching and resilience.
     */
    async getAccountDetails(address: string, retryOverride?: { retries?: number; delay?: number }): Promise<AccountDetails> {
        this.validateAddress(address);
        this.checkCircuit();

        const cacheKey = `account_${address}`;
        const cached = this.getFromCache<AccountDetails>(cacheKey);
        if (cached) return cached;

        try {
            const account = (await this.withRetry(
                () => this.server.loadAccount(address),
                retryOverride?.retries ?? 3,
                retryOverride?.delay ?? 1000
            )) as Horizon.AccountResponse;
            const details: AccountDetails = {
                id: account.id,
                sequence: account.sequenceNumber(),
                balances: account.balances as unknown as Balance[],
                signers: account.signers as unknown as AccountDetails['signers'],
                flags: {
                    auth_required: account.flags.auth_required,
                    auth_revocable: account.flags.auth_revocable,
                    auth_immutable: account.flags.auth_immutable,
                    auth_clawback_enabled: account.flags.auth_clawback_enabled,
                },
            };
            this.setCache(cacheKey, details);
            this.circuitBreaker.failures = 0; // Success resets failures
            return details;
        } catch (error: unknown) {
            this.handleHorizonError(error);
        }
    }

    /**
     * Fetches account balances.
     */
    async getAccountBalances(address: string): Promise<Balance[]> {
        const details = await this.getAccountDetails(address);
        return details.balances;
    }

    /**
     * Fetches transaction history for an account.
     */
    async getTransactions(address: string, options: PaginationOptions = {}) {
        this.validateAddress(address);
        this.checkCircuit();

        try {
            const query = this.server.transactions().forAccount(address);
            if (options.cursor) query.cursor(options.cursor);
            if (options.limit) query.limit(options.limit);
            if (options.order) query.order(options.order);

            const response = (await this.withRetry(() => query.call())) as Horizon.ServerApi.CollectionPage<Horizon.ServerApi.TransactionRecord>;
            return response.records.map((record: Horizon.ServerApi.TransactionRecord) => ({
                id: record.id,
                hash: record.hash,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ledger: (record as any).ledger_attr,
                created_at: record.created_at,
                source_account: record.source_account,
                fee_charged: record.fee_charged,
                memo: record.memo,
                memo_type: record.memo_type,
                successful: record.successful,
            }));
        } catch (error: unknown) {
            this.handleHorizonError(error);
        }
    }

    /**
     * Fetches payment operations for an account.
     */
    async getPayments(address: string, options: PaginationOptions = {}) {
        this.validateAddress(address);
        this.checkCircuit();

        try {
            const query = this.server.payments().forAccount(address);
            if (options.cursor) query.cursor(options.cursor);
            if (options.limit) query.limit(options.limit);
            if (options.order) query.order(options.order);

            const response = (await this.withRetry(() => query.call())) as Horizon.ServerApi.CollectionPage<Horizon.ServerApi.PaymentOperationRecord>;
            return response.records.map((record: Horizon.ServerApi.PaymentOperationRecord) => ({
                id: record.id,
                type: record.type,
                from: record.from,
                to: record.to,
                asset_type: record.asset_type,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                asset_code: (record as any).asset_code,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                asset_issuer: (record as any).asset_issuer,
                amount: record.amount,
                created_at: record.created_at,
                transaction_hash: record.transaction_hash,
            }));
        } catch (error: unknown) {
            this.handleHorizonError(error);
        }
    }

    /**
     * Handles and maps Horizon SDK errors to typed application errors with circuit breaker integration.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private handleHorizonError(error: any): never {
        const status = error.response?.status;
        const msg = error.message || 'Unknown error';

        if (status >= 500 || status === undefined) {
            this.circuitBreaker.failures++;
            this.circuitBreaker.lastFailure = Date.now();
            if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
                console.error('[Horizon] Circuit breaker OPEN due to repeated failures');
                this.circuitBreaker.isOpen = true;
            }
        }

        if (error.response) {
            const { data } = error.response;
            if (status === 404) {
                throw new HorizonError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
            }
            if (status === 429) {
                throw new HorizonError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
            }
            const message = data?.detail || msg;
            throw new HorizonError(message, status, 'HORIZON_API_ERROR');
        }

        throw new HorizonError(msg, 500, 'NETWORK_ERROR');
    }

    /**
     * Implementation of jittered exponential backoff for transient failures.
     */
    private async withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new HorizonError('Request timeout', 408, 'TIMEOUT')), this.REQUEST_TIMEOUT)
        );

        try {
            return (await Promise.race([fn(), timeoutPromise])) as T;
        } catch (error: unknown) {
            const err = error as { response?: { status?: number }; code?: string };
            const status = err.response?.status;
            const isTransient = status === 429 || (status !== undefined && status >= 500 && status < 600) || !status || err.code === 'TIMEOUT';

            if (isTransient && retries > 0) {
                // Jittered backoff: delay * (1 + random)
                const jitter = Math.random() * 200;
                const nextDelay = delay * 2 + jitter;

                console.warn(`[Horizon] Transient error detected (Status: ${status}, Code: ${err.code}). Retrying in ${Math.round(nextDelay)}ms... (${retries} retries left)`);
                await new Promise((resolve) => setTimeout(resolve, nextDelay));
                return this.withRetry(fn, retries - 1, nextDelay);
            }
            throw error;
        }
    }

    /**
     * Cache management helpers.
     */
    private getFromCache<T>(key: string): T | null {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data as T;
        }
        if (cached) this.cache.delete(key);
        return null;
    }

    private setCache(key: string, data: unknown): void {
        this.cache.set(key, { data, timestamp: Date.now() });
    }
}

// Export a singleton instance
export const horizonService = new HorizonService();
