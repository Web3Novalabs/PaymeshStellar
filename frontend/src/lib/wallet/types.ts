export type StellarNetwork = 'PUBLIC' | 'TESTNET' | 'FUTURENET' | 'STANDALONE';

export interface WalletDisconnected {
  status: 'disconnected';
}

export interface WalletConnecting {
  status: 'connecting';
}

export interface WalletConnected {
  status: 'connected';
  address: string;
  network: StellarNetwork;
}

export interface WalletError {
  status: 'error';
  error: string;
}

export type WalletStatus = WalletDisconnected | WalletConnecting | WalletConnected | WalletError;

export interface WalletAdapter {
  isAvailable(): Promise<boolean>;
  getAddress(): Promise<string>;
  getNetwork(): Promise<StellarNetwork>;
  signTransaction(
    xdr: string,
    opts?: { network?: string; accountToSign?: string }
  ): Promise<string>;
  addEventListener?: (
    event: 'accountChanged' | 'networkChanged',
    handler: () => void
  ) => () => void;
}

export interface AuthChallenge {
  address: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface AuthTokens {
  token: string;
  address: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
