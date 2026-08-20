import { Networks } from '@stellar/stellar-sdk';

export function validateSorobanEnvironment(): void {
  if (process.env.NODE_ENV !== 'test') {
    if (!process.env.SOROBAN_RPC_URL) {
      throw new Error('SOROBAN_RPC_URL must be set');
    }
    if (!process.env.AUTOSHARE_CONTRACT_ID) {
      throw new Error('AUTOSHARE_CONTRACT_ID must be set');
    }
    if (!process.env.SOROBAN_NETWORK_PASSPHRASE) {
      throw new Error('SOROBAN_NETWORK_PASSPHRASE must be set');
    }
  }
}

export function sorobanConfig() {
  return {
    rpcUrl: process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
    networkPassphrase: process.env.SOROBAN_NETWORK_PASSPHRASE || Networks.TESTNET,
    contractId:
      process.env.AUTOSHARE_CONTRACT_ID ||
      'C0000000000000000000000000000000000000000000000000000000',
  };
}
