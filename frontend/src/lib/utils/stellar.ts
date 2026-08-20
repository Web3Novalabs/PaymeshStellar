import { StrKey } from '@stellar/stellar-sdk';

/**
 * Validates a Stellar public key using StrKey.isValidEd25519PublicKey.
 * This performs checksum verification, not just regex matching.
 *
 * @param address - The Stellar address to validate
 * @returns true if the address is a valid Ed25519 public key with correct checksum
 */
export function isValidStellarAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

/**
 * Formats a Stellar address for display by showing first 4 and last 4 characters.
 *
 * @param address - The Stellar address to format
 * @returns Formatted address like "GDAB...XYZ"
 */
export function formatStellarAddress(address: string): string {
  if (!address || address.length < 8) {
    return address;
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
