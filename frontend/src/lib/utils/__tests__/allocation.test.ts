import {
  validateAllocation,
  calculateShares,
  splitEvenly,
  rebalanceAllocation,
  getRemainingBasisPoints,
  basisPointsToPercentage,
  percentageToBasisPoints,
  TOTAL_BASIS_POINTS,
} from '../allocation';
import type { MemberAllocation } from '../allocation';

describe('allocation utilities', () => {
  describe('validateAllocation', () => {
    it('should return true for valid allocation summing to 10000', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 5000, locked: false },
        { id: '2', address: 'G2', name: 'B', basisPoints: 5000, locked: false },
      ];
      expect(validateAllocation(members)).toBe(true);
    });

    it('should return false for empty members', () => {
      expect(validateAllocation([])).toBe(false);
    });

    it('should return false for zero basis points', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 0, locked: false },
        { id: '2', address: 'G2', name: 'B', basisPoints: 10000, locked: false },
      ];
      expect(validateAllocation(members)).toBe(false);
    });

    it('should return false for total not equal to 10000', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 5000, locked: false },
        { id: '2', address: 'G2', name: 'B', basisPoints: 4000, locked: false },
      ];
      expect(validateAllocation(members)).toBe(false);
    });

    it('should return false for over-allocation (10001)', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 10001, locked: false },
      ];
      expect(validateAllocation(members)).toBe(false);
    });

    it('should return false for under-allocation (9999)', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 9999, locked: false },
      ];
      expect(validateAllocation(members)).toBe(false);
    });
  });

  describe('splitEvenly', () => {
    it('should split evenly for 3 members', () => {
      const result = splitEvenly(3);
      expect(result).toHaveLength(3);
      expect(result.reduce((sum, bp) => sum + bp, 0)).toBe(TOTAL_BASIS_POINTS);
      // 10000 / 3 = 3333.33, so we expect [3333, 3333, 3334]
      expect(result).toEqual([3333, 3333, 3334]);
    });

    it('should split evenly for 6 members', () => {
      const result = splitEvenly(6);
      expect(result).toHaveLength(6);
      expect(result.reduce((sum, bp) => sum + bp, 0)).toBe(TOTAL_BASIS_POINTS);
      // 10000 / 6 = 1666.67, so we expect [1666, 1666, 1667, 1666, 1666, 1667]
      expect(result).toEqual([1666, 1666, 1667, 1666, 1666, 1667]);
    });

    it('should split evenly for 7 members', () => {
      const result = splitEvenly(7);
      expect(result).toHaveLength(7);
      expect(result.reduce((sum, bp) => sum + bp, 0)).toBe(TOTAL_BASIS_POINTS);
      // 10000 / 7 = 1428.57, so we expect [1428, 1428, 1429, 1428, 1428, 1429, 1428]
      expect(result).toEqual([1428, 1428, 1429, 1428, 1428, 1429, 1428]);
    });

    it('should return empty array for 0 members', () => {
      expect(splitEvenly(0)).toEqual([]);
    });

    it('should place dust deterministically on last members', () => {
      const result = splitEvenly(3);
      // Dust (remainder) should go to the last member(s)
      const baseShare = Math.floor(TOTAL_BASIS_POINTS / 3);
      const remainder = TOTAL_BASIS_POINTS - baseShare * 3;
      
      // The last 'remainder' members should have +1
      let dustCount = 0;
      for (let i = result.length - 1; i >= result.length - remainder; i--) {
        if (result[i] === baseShare + 1) dustCount++;
      }
      expect(dustCount).toBe(remainder);
    });
  });

  describe('calculateShares', () => {
    it('should calculate shares using floor division for all but last member', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 5000, locked: false },
        { id: '2', address: 'G2', name: 'B', basisPoints: 5000, locked: false },
      ];
      const shares = calculateShares(100, members);
      expect(shares).toHaveLength(2);
      expect(shares[0].share).toBe(50); // 100 * 5000 / 10000 = 50
      expect(shares[1].share).toBe(50); // Last member gets remainder
      expect(shares[1].isDustRecipient).toBe(true);
    });

    it('should handle dust allocation correctly', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 3333, locked: false },
        { id: '2', address: 'G2', name: 'B', basisPoints: 3333, locked: false },
        { id: '3', address: 'G3', name: 'C', basisPoints: 3334, locked: false },
      ];
      const shares = calculateShares(100, members);
      expect(shares).toHaveLength(3);
      expect(shares[0].share).toBe(33); // floor(100 * 3333 / 10000) = 33
      expect(shares[1].share).toBe(33); // floor(100 * 3333 / 10000) = 33
      expect(shares[2].share).toBe(34); // Last member gets dust: 100 - 33 - 33 = 34
      expect(shares[2].isDustRecipient).toBe(true);
    });

    it('should return empty array for zero amount', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 10000, locked: false },
      ];
      const shares = calculateShares(0, members);
      expect(shares).toEqual([]);
    });

    it('should return empty array for empty members', () => {
      const shares = calculateShares(100, []);
      expect(shares).toEqual([]);
    });

    it('should ensure total shares equals input amount', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 2500, locked: false },
        { id: '2', address: 'G2', name: 'B', basisPoints: 2500, locked: false },
        { id: '3', address: 'G3', name: 'C', basisPoints: 2500, locked: false },
        { id: '4', address: 'G4', name: 'D', basisPoints: 2500, locked: false },
      ];
      const testAmount = 12345;
      const shares = calculateShares(testAmount, members);
      const total = shares.reduce((sum, s) => sum + s.share, 0);
      expect(total).toBe(testAmount);
    });
  });

  describe('rebalanceAllocation', () => {
    it('should rebalance unlocked members while preserving locked', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 2000, locked: true },
        { id: '2', address: 'G2', name: 'B', basisPoints: 4000, locked: false },
        { id: '3', address: 'G3', name: 'C', basisPoints: 4000, locked: false },
      ];
      const result = rebalanceAllocation(members);
      expect(result[0].basisPoints).toBe(2000); // Locked member unchanged
      expect(result[1].basisPoints).toBe(4000); // Unlocked rebalanced
      expect(result[2].basisPoints).toBe(4000); // Unlocked rebalanced
      expect(result.reduce((sum, m) => sum + m.basisPoints, 0)).toBe(TOTAL_BASIS_POINTS);
    });

    it('should handle all locked members', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 5000, locked: true },
        { id: '2', address: 'G2', name: 'B', basisPoints: 5000, locked: true },
      ];
      const result = rebalanceAllocation(members);
      expect(result).toEqual(members);
    });

    it('should handle all unlocked members', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 2000, locked: false },
        { id: '2', address: 'G2', name: 'B', basisPoints: 8000, locked: false },
      ];
      const result = rebalanceAllocation(members);
      expect(result.reduce((sum, m) => sum + m.basisPoints, 0)).toBe(TOTAL_BASIS_POINTS);
      // Should split evenly
      expect(result[0].basisPoints).toBe(5000);
      expect(result[1].basisPoints).toBe(5000);
    });

    it('should set minimum when locked exceeds total', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 11000, locked: true },
        { id: '2', address: 'G2', name: 'B', basisPoints: 0, locked: false },
      ];
      const result = rebalanceAllocation(members);
      expect(result[0].basisPoints).toBe(11000); // Locked unchanged
      expect(result[1].basisPoints).toBe(0); // Unlocked set to minimum
    });
  });

  describe('getRemainingBasisPoints', () => {
    it('should return 0 for exact 10000', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 10000, locked: false },
      ];
      expect(getRemainingBasisPoints(members)).toBe(0);
    });

    it('should return positive for under-allocation', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 5000, locked: false },
      ];
      expect(getRemainingBasisPoints(members)).toBe(5000);
    });

    it('should return negative for over-allocation', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 12000, locked: false },
      ];
      expect(getRemainingBasisPoints(members)).toBe(-2000);
    });

    it('should return 10000 for empty members', () => {
      expect(getRemainingBasisPoints([])).toBe(10000);
    });
  });

  describe('basisPointsToPercentage', () => {
    it('should convert basis points to percentage', () => {
      expect(basisPointsToPercentage(10000)).toBe('100.00');
      expect(basisPointsToPercentage(5000)).toBe('50.00');
      expect(basisPointsToPercentage(3333)).toBe('33.33');
      expect(basisPointsToPercentage(1)).toBe('0.01');
    });

    it('should respect decimal parameter', () => {
      expect(basisPointsToPercentage(3333, 1)).toBe('33.3');
      expect(basisPointsToPercentage(3333, 0)).toBe('33');
    });
  });

  describe('percentageToBasisPoints', () => {
    it('should convert percentage to basis points', () => {
      expect(percentageToBasisPoints(100)).toBe(10000);
      expect(percentageToBasisPoints(50)).toBe(5000);
      expect(percentageToBasisPoints(33.33)).toBe(3333);
      expect(percentageToBasisPoints(0.01)).toBe(1);
    });

    it('should round to nearest integer', () => {
      expect(percentageToBasisPoints(33.333)).toBe(3333);
      expect(percentageToBasisPoints(33.337)).toBe(3334);
    });
  });

  describe('boundary cases', () => {
    it('should handle 9999 basis points (invalid)', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 9999, locked: false },
      ];
      expect(validateAllocation(members)).toBe(false);
      expect(getRemainingBasisPoints(members)).toBe(1);
    });

    it('should handle 10000 basis points (valid)', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 10000, locked: false },
      ];
      expect(validateAllocation(members)).toBe(true);
      expect(getRemainingBasisPoints(members)).toBe(0);
    });

    it('should handle 10001 basis points (invalid)', () => {
      const members: MemberAllocation[] = [
        { id: '1', address: 'G1', name: 'A', basisPoints: 10001, locked: false },
      ];
      expect(validateAllocation(members)).toBe(false);
      expect(getRemainingBasisPoints(members)).toBe(-1);
    });
  });
});
