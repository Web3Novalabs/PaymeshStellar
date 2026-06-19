// Stellar address: G... prefix, 56 chars, Base32 alphabet
const STELLAR_ADDRESS_REGEX = /^G[A-D2-7][A-Z2-7]{54}$/;

export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(address);
}
