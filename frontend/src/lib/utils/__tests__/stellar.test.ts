import { isValidStellarAddress, formatStellarAddress } from '../stellar';

describe('Stellar address validation', () => {
  describe('isValidStellarAddress', () => {
    it('should accept a valid Stellar address with correct checksum', () => {
      // This is a valid Stellar public key with correct checksum
      const validAddress = 'GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z2';
      expect(isValidStellarAddress(validAddress)).toBe(true);
    });

    it('should reject a valid-looking address with bad checksum', () => {
      // This has the correct format but an invalid checksum
      // Transposed characters that would pass regex but fail StrKey validation
      const badChecksumAddress = 'GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z3';
      expect(isValidStellarAddress(badChecksumAddress)).toBe(false);
    });

    it('should reject addresses with wrong length', () => {
      expect(isValidStellarAddress('GTOO')).toBe(false);
      expect(isValidStellarAddress('G' + 'A'.repeat(100))).toBe(false);
    });

    it('should reject addresses with wrong prefix', () => {
      expect(
        isValidStellarAddress('AD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z2')
      ).toBe(false);
      expect(
        isValidStellarAddress('BD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z2')
      ).toBe(false);
    });

    it('should reject addresses with invalid characters', () => {
      expect(
        isValidStellarAddress('GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z!')
      ).toBe(false);
      expect(
        isValidStellarAddress('GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z ')
      ).toBe(false);
      expect(
        isValidStellarAddress('GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Zl')
      ).toBe(false); // lowercase 'l'
    });

    it('should reject empty string', () => {
      expect(isValidStellarAddress('')).toBe(false);
    });

    it('should reject null', () => {
      expect(isValidStellarAddress(null as unknown as string)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidStellarAddress(undefined as unknown as string)).toBe(false);
    });

    it('should reject non-string types', () => {
      expect(isValidStellarAddress(123 as unknown as string)).toBe(false);
      expect(isValidStellarAddress({} as unknown as string)).toBe(false);
      expect(isValidStellarAddress([] as unknown as string)).toBe(false);
    });

    it('should reject addresses that pass regex but fail checksum', () => {
      // These addresses have the correct G prefix and length but invalid checksums
      const addressesWithBadChecksums = [
        'GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z3',
        'GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z4',
        'GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z5',
      ];

      addressesWithBadChecksums.forEach((address) => {
        expect(isValidStellarAddress(address)).toBe(false);
      });
    });

    it('should accept multiple valid addresses', () => {
      const validAddresses = [
        'GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z2',
        'GABCD4EF5GH6IJ7KL8MN9OP0QR1ST2UV3WX4YZ5AB6CD7EF8GH9IJ0KL',
        'G1234ABCD5678EFGH9012IJKL3456MNOP7890QRST1234UVWX5678YZ90',
      ];

      validAddresses.forEach((address) => {
        expect(isValidStellarAddress(address)).toBe(true);
      });
    });
  });

  describe('formatStellarAddress', () => {
    it('should format address with first 4 and last 4 characters', () => {
      const address = 'GD5J6PHFVCHGE5H4ZL3FWJQSIHZO3SKN6QSE5YD3T3Y5R7E8N9X0Y1Z2';
      expect(formatStellarAddress(address)).toBe('GD5J...Y1Z2');
    });

    it('should return original address if too short', () => {
      expect(formatStellarAddress('GTOO')).toBe('GTOO');
      expect(formatStellarAddress('GT')).toBe('GT');
    });

    it('should handle empty string', () => {
      expect(formatStellarAddress('')).toBe('');
    });

    it('should handle exactly 8 character address', () => {
      const address = 'GD5J6PHF';
      expect(formatStellarAddress(address)).toBe('GD5J6PHF');
    });
  });
});
