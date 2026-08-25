import * as StellarSdk from '@stellar/stellar-sdk';
import { requestChallenge, verifyChallenge } from '../api/client';
import type { WalletAdapter, AuthTokens } from '../wallet/types';

export async function authenticateWithWallet(
  wallet: WalletAdapter,
  expectedNetwork: string
): Promise<AuthTokens> {
  const address = await wallet.getAddress();
  const network = await wallet.getNetwork();

  if (network !== expectedNetwork) {
    throw new Error(
      `Network mismatch: wallet is on "${network}" but the app expects "${expectedNetwork}". Please switch your wallet network.`
    );
  }

  const challenge = await requestChallenge(address);

  const server = new StellarSdk.Horizon.Server(
    network === 'PUBLIC'
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org'
  );

  const account = await server.loadAccount(address);

  const txBuilder = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase:
      network === 'PUBLIC'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET,
  });

  const tx = txBuilder
    .addOperation(
      StellarSdk.Operation.manageData({
        source: address,
        name: 'paymesh-auth-nonce',
        value: Buffer.from(challenge.nonce, 'utf8'),
      })
    )
    .setTimeout(180)
    .build();

  const signedXdr = await wallet.signTransaction(tx.toXDR(), {
    network:
      network === 'PUBLIC'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET,
    accountToSign: address,
  });

  const signature = signedXdr;

  return verifyChallenge(address, challenge.nonce, signature);
}
