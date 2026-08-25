import type { StellarNetwork, WalletAdapter } from './types';

const ALLOWED_NETWORKS: StellarNetwork[] = ['PUBLIC', 'TESTNET', 'FUTURENET'];

function isAllowedNetwork(network: string): network is StellarNetwork {
  return ALLOWED_NETWORKS.includes(network as StellarNetwork);
}

export function createFreighterAdapter(): WalletAdapter {
  return {
    async isAvailable(): Promise<boolean> {
      try {
        const mod = await import('@stellar/freighter-api');
        if (typeof mod.isConnected !== 'function') return false;
        const result = await mod.isConnected();
        if (result.error) return false;
        return result.isConnected;
      } catch {
        return false;
      }
    },

    async getAddress(): Promise<string> {
      const mod = await import('@stellar/freighter-api');
      if (typeof mod.getAddress !== 'function') {
        throw new Error(
          'Freighter is not installed. Please install the Freighter browser extension.'
        );
      }
      const result = await mod.getAddress();
      if (result.error) {
        throw new Error(String(result.error));
      }
      return result.address;
    },

    async getNetwork(): Promise<StellarNetwork> {
      const mod = await import('@stellar/freighter-api');
      if (typeof mod.getNetwork !== 'function') {
        throw new Error('Freighter is not installed.');
      }
      const result = await mod.getNetwork();
      if (result.error) {
        throw new Error(String(result.error));
      }
      const network = result.network;
      if (!isAllowedNetwork(network)) {
        throw new Error(
          `Unsupported network "${network}". Please switch to Testnet or Public in Freighter.`
        );
      }
      return network;
    },

    async signTransaction(
      xdr: string,
      opts?: { network?: string; accountToSign?: string }
    ): Promise<string> {
      const mod = await import('@stellar/freighter-api');
      if (typeof mod.signTransaction !== 'function') {
        throw new Error('Freighter is not installed.');
      }
      const result = await mod.signTransaction(xdr, {
        networkPassphrase: opts?.network,
        address: opts?.accountToSign,
      });
      if (result.error) {
        throw new Error(String(result.error));
      }
      return result.signedTxXdr;
    },

    addEventListener(event, handler) {
      const eventMap: Record<string, string> = {
        accountChanged: 'stellar:accountChanged',
        networkChanged: 'stellar:networkChanged',
      };
      const eventName = eventMap[event];
      if (!eventName) return () => {};

      const wrappedHandler = () => handler();
      window.addEventListener(eventName, wrappedHandler);
      return () => window.removeEventListener(eventName, wrappedHandler);
    },
  };
}
