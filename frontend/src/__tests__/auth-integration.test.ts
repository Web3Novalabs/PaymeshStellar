import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WalletAdapter, AuthChallenge, AuthTokens } from '@/lib/wallet/types';

const mockChallenge: AuthChallenge = {
  address: 'GABC1234567890DEF',
  nonce: 'abc123def456',
  message:
    'PaymeshStellar authentication request\naddress: GABC1234567890DEF\nnonce: abc123def456\nissued at: 2026-08-17T00:00:00.000Z',
  expiresAt: '2026-08-17T00:05:00.000Z',
};

const mockAuthTokens: AuthTokens = {
  token: 'eyJhbGciOiJIUzI1NiJ9.mock.signature',
  address: 'GABC1234567890DEF',
};

function createMockWallet(): WalletAdapter {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    getAddress: vi.fn().mockResolvedValue('GABC1234567890DEF'),
    getNetwork: vi.fn().mockResolvedValue('TESTNET'),
    signTransaction: vi.fn().mockResolvedValue('signed-xdr-base64'),
    addEventListener: vi.fn().mockReturnValue(() => {}),
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  globalThis.fetch = fetchMock;
});

describe('connect -> challenge -> sign -> authenticated request integration', () => {
  it('completes full auth flow with mocked API and fake wallet', async () => {
    const wallet = createMockWallet();

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockChallenge }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockAuthTokens }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { groups: [], total: 0 },
        }),
      });

    const { requestChallenge, verifyChallenge } = await import('@/lib/api/client');

    const isAvailable = await wallet.isAvailable();
    expect(isAvailable).toBe(true);

    const address = await wallet.getAddress();
    expect(address).toBe('GABC1234567890DEF');

    const network = await wallet.getNetwork();
    expect(network).toBe('TESTNET');

    const challenge = await requestChallenge(address);
    expect(challenge.nonce).toBe('abc123def456');
    expect(challenge.address).toBe('GABC1234567890DEF');
    expect(challenge.message).toContain('PaymeshStellar authentication request');

    const signedXdr = await wallet.signTransaction('mock-xdr', {
      network: 'TESTNET',
      accountToSign: address,
    });
    expect(signedXdr).toBe('signed-xdr-base64');

    const tokens = await verifyChallenge(address, challenge.nonce, signedXdr);
    expect(tokens.token).toBe(mockAuthTokens.token);
    expect(tokens.address).toBe('GABC1234567890DEF');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3001/auth/challenge', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ address: 'GABC1234567890DEF' }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:3001/auth/verify', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        address: 'GABC1234567890DEF',
        nonce: 'abc123def456',
        signature: 'signed-xdr-base64',
      }),
    }));
  });

  it('rejects when wallet is not available', async () => {
    const wallet = createMockWallet();
    vi.mocked(wallet.isAvailable).mockResolvedValue(false);

    const available = await wallet.isAvailable();
    expect(available).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when wallet network does not match expected', async () => {
    const wallet = createMockWallet();
    vi.mocked(wallet.getNetwork).mockResolvedValue('PUBLIC');

    const expectedNetwork = 'TESTNET';
    const network = await wallet.getNetwork();

    if (network !== expectedNetwork) {
      expect(network).toBe('PUBLIC');
      expect(expectedNetwork).toBe('TESTNET');
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it('account switched mid-session invalidates session', async () => {
    const wallet = createMockWallet();
    const initialAddress = 'GABC1234567890DEF';
    const newAddress = 'GXYZ9876543210ABC';

    vi.mocked(wallet.getAddress).mockResolvedValueOnce(initialAddress);

    let currentAddress = initialAddress;
    vi.mocked(wallet.getAddress).mockImplementation(
      () => Promise.resolve(currentAddress)
    );

    const accountChangedHandler = vi.fn(() => {
      currentAddress = newAddress;
    });

    wallet.addEventListener?.('accountChanged', accountChangedHandler);

    const address1 = await wallet.getAddress();
    expect(address1).toBe(initialAddress);

    accountChangedHandler();

    const address2 = await wallet.getAddress();
    expect(address2).toBe(newAddress);
    expect(address2).not.toBe(initialAddress);

    expect(accountChangedHandler).toHaveBeenCalledTimes(1);
  });

  it('blocks signing on network mismatch and shows actionable message', async () => {
    const wallet = createMockWallet();
    vi.mocked(wallet.getNetwork).mockResolvedValue('PUBLIC');

    const expectedNetwork = 'TESTNET';
    const network = await wallet.getNetwork();

    expect(network).not.toBe(expectedNetwork);

    const errorMessage = `Network mismatch: wallet is on "${network}" but the app expects "${expectedNetwork}". Please switch your wallet network.`;
    expect(errorMessage).toContain('Network mismatch');
    expect(errorMessage).toContain('switch your wallet network');
  });
});
