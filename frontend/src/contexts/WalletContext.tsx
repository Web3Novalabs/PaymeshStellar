'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { WalletAdapter, WalletStatus, StellarNetwork } from '@/lib/wallet/types';
import { createFreighterAdapter } from '@/lib/wallet/freighter';
import { authenticateWithWallet } from '@/lib/auth/auth';
import { scheduleRefresh, resetRefreshState } from '@/lib/auth/refresh';
import { setAccessToken } from '@/lib/api/client';

interface WalletContextValue {
  status: WalletStatus;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
  address: string | null;
  network: StellarNetwork | null;
  statusMessage: string;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const EXPECTED_NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'TESTNET') as StellarNetwork;

function formatAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>({ status: 'disconnected' });
  const [statusMessage, setStatusMessage] = useState('');
  const walletRef = useRef<WalletAdapter>(createFreighterAdapter());

  const announce = useCallback((msg: string) => {
    setStatusMessage(msg);
  }, []);

  const connect = useCallback(async () => {
    const wallet = walletRef.current;

    const available = await wallet.isAvailable();
    if (!available) {
      setStatus({ status: 'error', error: 'Freighter wallet extension is not installed.' });
      announce('Wallet extension not found. Please install Freighter.');
      return;
    }

    setStatus({ status: 'connecting' });
    announce('Connecting to wallet...');

    try {
      const authTokens = await authenticateWithWallet(wallet, EXPECTED_NETWORK);
      const address = await wallet.getAddress();
      const network = await wallet.getNetwork();

      setAccessToken(authTokens.token);
      scheduleRefresh(authTokens.token);

      setStatus({ status: 'connected', address, network });
      announce(`Connected as ${formatAddress(address)}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus({ status: 'error', error: message });
      announce(`Connection failed: ${message}`);
    }
  }, [announce]);

  const disconnect = useCallback(() => {
    resetRefreshState();
    setStatus({ status: 'disconnected' });
    announce('Wallet disconnected');
  }, [announce]);

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (status.status !== 'connected') {
        throw new Error('Wallet not connected');
      }
      return walletRef.current.signTransaction(xdr, {
        network: status.network,
        accountToSign: status.address,
      });
    },
    [status]
  );

  useEffect(() => {
    const wallet = walletRef.current;
    const unsubAccount = wallet.addEventListener?.('accountChanged', () => {
      if (status.status === 'connected') {
        setStatus({ status: 'disconnected' });
        resetRefreshState();
        announce('Account changed in wallet. Please reconnect.');
      }
    });
    const unsubNetwork = wallet.addEventListener?.('networkChanged', () => {
      if (status.status === 'connected') {
        setStatus({ status: 'disconnected' });
        resetRefreshState();
        announce('Network changed in wallet. Please reconnect.');
      }
    });

    return () => {
      unsubAccount?.();
      unsubNetwork?.();
    };
  }, [status, announce]);

  useEffect(() => {
    return () => {
      resetRefreshState();
    };
  }, []);

  const value: WalletContextValue = {
    status,
    connect,
    disconnect,
    signTransaction,
    address: status.status === 'connected' ? status.address : null,
    network: status.status === 'connected' ? status.network : null,
    statusMessage,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return ctx;
}
