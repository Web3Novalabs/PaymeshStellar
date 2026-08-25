'use client';

import { useWallet } from '@/contexts/WalletContext';

export default function AuthStatusAnnouncer() {
  const { statusMessage } = useWallet();

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {statusMessage}
    </div>
  );
}
