import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { HorizonService } from '../horizon.js';
import { HorizonError } from '../../utils/errors.js';

describe('HorizonService', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let horizonService: any;
    // A valid cryptographically generated Stellar public key (ED25519)
    const mockAddress = 'GDHVHQN2JFDZ5XYBIA3QBLGTHR7GXJZVUDTVQJJXM7SOMXA5YYBSDFWX';

    beforeEach(() => {
        horizonService = new HorizonService();
    });

    describe('validateAddress', () => {
        test('should throw error for invalid Stellar address', async () => {
            await assert.rejects(
                () => horizonService.getAccountDetails('invalid-address'),
                {
                    code: 'INVALID_ADDRESS',
                    statusCode: 400,
                }
            );
        });
    });

    describe('getAccountDetails', () => {
        test('should fetch and map account details correctly', async () => {
            const mockAccount = {
                id: mockAddress,
                sequenceNumber: () => '12345',
                balances: [{ asset_type: 'native', balance: '100.0' }],
                signers: [{ key: mockAddress, weight: 1, type: 'ed25519_public_key' }],
                flags: {
                    auth_required: false,
                    auth_revocable: false,
                    auth_immutable: false,
                    auth_clawback_enabled: false,
                },
            };

            // Mock loadAccount
            mock.method(horizonService.server, 'loadAccount', async () => mockAccount);

            const details = await horizonService.getAccountDetails(mockAddress);

            assert.equal(details.id, mockAddress);
            assert.equal(details.sequence, '12345');
            assert.equal(details.balances[0].balance, '100.0');
        });

        test('should handle 404 account not found', async () => {
            const error404 = {
                response: { status: 404, data: { detail: 'Not Found' } },
            };

            mock.method(horizonService.server, 'loadAccount', async () => {
                throw error404;
            });

            await assert.rejects(
                () => horizonService.getAccountDetails(mockAddress),
                (err: HorizonError) => {
                    assert.ok(err instanceof HorizonError);
                    assert.equal(err.statusCode, 404);
                    assert.equal(err.code, 'ACCOUNT_NOT_FOUND');
                    return true;
                }
            );
        });

        test('should use cache for subsequent calls', async () => {
            const mockAccount = {
                id: mockAddress,
                sequenceNumber: () => '12345',
                balances: [],
                signers: [],
                flags: {
                    auth_required: false,
                    auth_revocable: false,
                    auth_immutable: false,
                    auth_clawback_enabled: false,
                },
            };

            const loadAccountMock = mock.method(horizonService.server, 'loadAccount', async () => mockAccount);

            await horizonService.getAccountDetails(mockAddress);
            await horizonService.getAccountDetails(mockAddress);

            assert.equal(loadAccountMock.mock.callCount(), 1);
        });
    });

    describe('resilience', () => {
        test('should retry on 429 rate limit error with jitter', async () => {
            let attempts = 0;
            const error429 = {
                response: { status: 429, data: { detail: 'Rate limit' } },
            };

            const fn = async () => {
                attempts++;
                if (attempts < 2) throw error429;
                return { success: true };
            };

            // Use small delay for tests
            const result = await horizonService.withRetry(fn, 2, 10);
            assert.equal(attempts, 2);
            assert.ok(result.success);
        });

        test('should open circuit breaker after repeated failures', async () => {
            const error500 = {
                response: { status: 500, data: { detail: 'Server Error' } },
            };

            mock.method(horizonService.server, 'loadAccount', async () => {
                throw error500;
            });

            // Trigger threshold (5) with retries disabled for speed
            for (let i = 0; i < 5; i++) {
                try {
                    await horizonService.getAccountDetails(mockAddress, { retries: 0 });
                } catch {
                    // expected
                }
            }

            // Next call should be blocked by circuit breaker
            await assert.rejects(
                () => horizonService.getAccountDetails(mockAddress),
                (err: HorizonError) => {
                    assert.equal(err.statusCode, 503);
                    assert.equal(err.code, 'SERVICE_UNAVAILABLE');
                    return true;
                }
            );
        });
    });
});
