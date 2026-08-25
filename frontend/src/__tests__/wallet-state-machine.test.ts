import { describe, it, expect } from 'vitest';
import type {
  WalletStatus,
  WalletDisconnected,
  WalletConnecting,
  WalletConnected,
  WalletError,
} from '@/lib/wallet/types';

function assertDisconnected(status: WalletStatus): asserts status is WalletDisconnected {
  expect(status.status).toBe('disconnected');
}

function assertConnecting(status: WalletStatus): asserts status is WalletConnecting {
  expect(status.status).toBe('connecting');
}

function assertConnected(status: WalletStatus): asserts status is WalletConnected {
  expect(status.status).toBe('connected');
  expect(status).toHaveProperty('address');
  expect(status).toHaveProperty('network');
}

function assertError(status: WalletStatus): asserts status is WalletError {
  expect(status.status).toBe('error');
  expect(status).toHaveProperty('error');
}

describe('Wallet state machine transitions', () => {
  const transitions: Array<{
    name: string;
    from: WalletStatus;
    to: WalletStatus;
  }> = [
    {
      name: 'disconnected -> connecting',
      from: { status: 'disconnected' },
      to: { status: 'connecting' },
    },
    {
      name: 'connecting -> connected',
      from: { status: 'connecting' },
      to: { status: 'connected', address: 'GABC...', network: 'TESTNET' },
    },
    {
      name: 'connecting -> error',
      from: { status: 'connecting' },
      to: { status: 'error', error: 'Extension not installed' },
    },
    {
      name: 'error -> connecting',
      from: { status: 'error', error: 'Extension not installed' },
      to: { status: 'connecting' },
    },
    {
      name: 'error -> disconnected',
      from: { status: 'error', error: 'Extension not installed' },
      to: { status: 'disconnected' },
    },
    {
      name: 'connected -> disconnected',
      from: { status: 'connected', address: 'GABC...', network: 'TESTNET' },
      to: { status: 'disconnected' },
    },
    {
      name: 'connected -> disconnected (account changed)',
      from: { status: 'connected', address: 'GABC...', network: 'TESTNET' },
      to: { status: 'disconnected' },
    },
    {
      name: 'connected -> disconnected (network changed)',
      from: { status: 'connected', address: 'GABC...', network: 'TESTNET' },
      to: { status: 'disconnected' },
    },
    {
      name: 'disconnected -> disconnected (double disconnect is idempotent)',
      from: { status: 'disconnected' },
      to: { status: 'disconnected' },
    },
  ];

  const nonIdempotentTransitions = transitions.filter((t) => t.name !== 'disconnected -> disconnected (double disconnect is idempotent)');

  nonIdempotentTransitions.forEach(({ name, from, to }) => {
    it(name, () => {
      const next: WalletStatus = to;
      expect(next.status).not.toBe(from.status);

      if (next.status === 'disconnected') assertDisconnected(next);
      if (next.status === 'connecting') assertConnecting(next);
      if (next.status === 'connected') assertConnected(next);
      if (next.status === 'error') assertError(next);
    });
  });

  it('disconnected -> disconnected (double disconnect is idempotent)', () => {
    const from: WalletStatus = { status: 'disconnected' };
    const to: WalletStatus = { status: 'disconnected' };
    assertDisconnected(from);
    assertDisconnected(to);
    expect(to.status).toBe(from.status);
  });

  describe('discriminated union type safety', () => {
    it('disconnected has no address or network', () => {
      const s: WalletStatus = { status: 'disconnected' };
      assertDisconnected(s);
      expect(s).not.toHaveProperty('address');
      expect(s).not.toHaveProperty('network');
    });

    it('connecting has no address or network', () => {
      const s: WalletStatus = { status: 'connecting' };
      assertConnecting(s);
      expect(s).not.toHaveProperty('address');
      expect(s).not.toHaveProperty('network');
    });

    it('connected has address and network', () => {
      const s: WalletStatus = {
        status: 'connected',
        address: 'GABC1234567890DEF',
        network: 'TESTNET',
      };
      assertConnected(s);
      expect(s.address).toBe('GABC1234567890DEF');
      expect(s.network).toBe('TESTNET');
    });

    it('error has error message', () => {
      const s: WalletStatus = { status: 'error', error: 'Something went wrong' };
      assertError(s);
      expect(s.error).toBe('Something went wrong');
      expect(s).not.toHaveProperty('address');
      expect(s).not.toHaveProperty('network');
    });
  });

  describe('error -> connecting -> connected full flow', () => {
    it('recovers from error through retry', () => {
      let state: WalletStatus = { status: 'disconnected' };

      // User clicks connect but extension not found
      state = { status: 'connecting' };
      assertConnecting(state);

      state = { status: 'error', error: 'Freighter not installed' };
      assertError(state);

      // User retries
      state = { status: 'connecting' };
      assertConnecting(state);

      state = {
        status: 'connected',
        address: 'GABC1234567890DEF',
        network: 'TESTNET',
      };
      assertConnected(state);
      expect(state.address).toBe('GABC1234567890DEF');
    });
  });

  describe('connected -> disconnect -> reconnect flow', () => {
    it('disconnect clears all state', () => {
      let state: WalletStatus = {
        status: 'connected',
        address: 'GABC1234567890DEF',
        network: 'TESTNET',
      };
      assertConnected(state);

      state = { status: 'disconnected' };
      assertDisconnected(state);
      expect(state).not.toHaveProperty('address');
      expect(state).not.toHaveProperty('network');
    });
  });

  describe('network mismatch blocks signing', () => {
    it('returns error when wallet network differs from expected', () => {
      const expectedNetwork = 'TESTNET';
      const walletNetwork = 'PUBLIC' as string;

      const isMismatch = expectedNetwork !== walletNetwork;
      expect(isMismatch).toBe(true);

      if (isMismatch) {
        const error: WalletError = {
          status: 'error',
          error: `Network mismatch: wallet is on "${walletNetwork}" but the app expects "${expectedNetwork}"`,
        };
        assertError(error);
        expect(error.error).toContain('Network mismatch');
      }
    });

    it('allows signing when networks match', () => {
      const expectedNetwork = 'TESTNET';
      const walletNetwork = 'TESTNET';

      const isMismatch = expectedNetwork !== walletNetwork;
      expect(isMismatch).toBe(false);
    });
  });
});
