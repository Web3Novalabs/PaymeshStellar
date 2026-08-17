'use client';

import { useWallet } from '@/contexts/WalletContext';
import Button from '@/components/Button';

export default function WalletConnectButton() {
  const { status, connect, disconnect } = useWallet();

  if (status.status === 'connected') {
    return (
      <Button
        variant="secondary"
        type="button"
        onClick={disconnect}
        aria-label="Disconnect wallet"
        className="text-sm"
      >
        Disconnect
      </Button>
    );
  }

  if (status.status === 'connecting') {
    return (
      <Button variant="primary" type="button" isLoading disabled className="text-sm">
        Connecting
      </Button>
    );
  }

  return (
    <Button
      variant="primary"
      type="button"
      onClick={() => void connect()}
      className="text-sm"
      aria-label="Connect Stellar wallet"
    >
      Connect Wallet
    </Button>
  );
}
