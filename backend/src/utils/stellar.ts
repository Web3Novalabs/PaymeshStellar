import { Keypair } from '@stellar/stellar-sdk';

// Stellar address: G... prefix, 56 chars, Base32 alphabet
const STELLAR_ADDRESS_REGEX = /^G[A-D][A-Z2-7]{54}$/;

export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(address);
}

export interface StellarSignatureVerifier {
  verify(address: string, message: string, signatureBase64: string): boolean;
}

/**
 * Verifies Stellar wallet signatures. Exposed as an object (rather than a bare
 * function) so tests can `mock.method(stellarSignatureVerifier, 'verify', ...)`
 * instead of exercising real keypairs.
 */
export const stellarSignatureVerifier: StellarSignatureVerifier = {
  verify(address: string, message: string, signatureBase64: string): boolean {
    if (!isValidStellarAddress(address)) return false;

    try {
      const keypair = Keypair.fromPublicKey(address);
      const signature = Buffer.from(signatureBase64, 'base64');
      return keypair.verify(Buffer.from(message, 'utf8'), signature);
    } catch {
      return false;
    }
  },
};
