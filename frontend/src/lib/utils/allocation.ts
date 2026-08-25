/**
 * Basis point constants and utilities for payroll group allocation.
 * All calculations use integer basis points (1 basis point = 0.01%).
 * 10,000 basis points = 100%.
 */

export const TOTAL_BASIS_POINTS = 10000;

/**
 * Member data structure for allocation calculations.
 */
export interface MemberAllocation {
  id: string;
  address: string;
  name: string;
  basisPoints: number;
  locked: boolean;
}

/**
 * Result of a share calculation.
 */
export interface ShareResult {
  memberId: string;
  basisPoints: number;
  share: number;
  isDustRecipient: boolean;
}

/**
 * Validates that all basis points are non-zero and sum to exactly 10,000.
 *
 * @param members - Array of member allocations
 * @returns true if valid, false otherwise
 */
export function validateAllocation(members: MemberAllocation[]): boolean {
  if (members.length === 0) {
    return false;
  }

  // Check for zero basis points
  if (members.some((m) => m.basisPoints <= 0)) {
    return false;
  }

  // Check total equals exactly 10,000
  const total = members.reduce((sum, m) => sum + m.basisPoints, 0);
  return total === TOTAL_BASIS_POINTS;
}

/**
 * Calculates shares for a given total amount using basis points.
 * Matches the contract's floor-plus-dust-to-last-member rule exactly.
 *
 * Every member except the last receives floor(total * basisPoints / 10000).
 * The last member receives the remaining dust to ensure shares sum exactly to total.
 *
 * @param totalAmount - The total amount to distribute
 * @param members - Array of member allocations
 * @returns Array of share results
 */
export function calculateShares(
  totalAmount: number,
  members: MemberAllocation[]
): ShareResult[] {
  if (members.length === 0 || totalAmount <= 0) {
    return [];
  }

  const results: ShareResult[] = [];
  let distributed = 0;

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const isLast = i === members.length - 1;

    let share: number;
    if (isLast) {
      // Last member gets the remaining dust
      share = totalAmount - distributed;
    } else {
      // Floor division for all other members
      share = Math.floor((totalAmount * member.basisPoints) / TOTAL_BASIS_POINTS);
    }

    results.push({
      memberId: member.id,
      basisPoints: member.basisPoints,
      share,
      isDustRecipient: isLast,
    });

    distributed += share;
  }

  return results;
}

/**
 * Splits basis points evenly among members, with deterministic dust placement.
 * Dust (remainder from division) is distributed to the last members to ensure
 * the total equals exactly 10,000.
 *
 * @param memberCount - Number of members to split among
 * @returns Array of basis point values summing to 10,000
 */
export function splitEvenly(memberCount: number): number[] {
  if (memberCount <= 0) {
    return [];
  }

  const baseShare = Math.floor(TOTAL_BASIS_POINTS / memberCount);
  const remainder = TOTAL_BASIS_POINTS - baseShare * memberCount;

  const result = new Array(memberCount).fill(baseShare);

  // Distribute remainder to the last 'remainder' members
  for (let i = 0; i < remainder; i++) {
    result[memberCount - 1 - i] += 1;
  }

  return result;
}

/**
 * Rebalances basis points among unlocked members to reach exactly 10,000.
 * Locked members retain their current allocation.
 *
 * @param members - Array of member allocations
 * @returns New array with rebalanced basis points
 */
export function rebalanceAllocation(members: MemberAllocation[]): MemberAllocation[] {
  const lockedTotal = members
    .filter((m) => m.locked)
    .reduce((sum, m) => sum + m.basisPoints, 0);

  const unlockedMembers = members.filter((m) => !m.locked);
  const unlockedCount = unlockedMembers.length;

  if (unlockedCount === 0) {
    // All members locked, return as-is (should already sum to 10,000 if valid)
    return members;
  }

  const remaining = TOTAL_BASIS_POINTS - lockedTotal;

  if (remaining <= 0) {
    // Not enough room for unlocked members, set them to minimum
    return members.map((m) => ({
      ...m,
      basisPoints: m.locked ? m.basisPoints : 0,
    }));
  }

  // Split remaining evenly among unlocked members
  const evenSplit = splitEvenly(unlockedCount);
  const scaledSplit = evenSplit.map((bp) => Math.floor((bp * remaining) / TOTAL_BASIS_POINTS));

  // Distribute any remainder from scaling
  const scaledTotal = scaledSplit.reduce((sum, bp) => sum + bp, 0);
  const remainder = remaining - scaledTotal;

  for (let i = 0; i < remainder; i++) {
    scaledSplit[scaledSplit.length - 1 - i] += 1;
  }

  // Apply new values to unlocked members
  let splitIndex = 0;
  return members.map((m) => {
    if (m.locked) {
      return m;
    }
    return {
      ...m,
      basisPoints: scaledSplit[splitIndex++],
    };
  });
}

/**
 * Calculates the remaining basis points needed to reach 10,000.
 *
 * @param members - Array of member allocations
 * @returns Remaining basis points (can be negative if over-allocated)
 */
export function getRemainingBasisPoints(members: MemberAllocation[]): number {
  const total = members.reduce((sum, m) => sum + m.basisPoints, 0);
  return TOTAL_BASIS_POINTS - total;
}

/**
 * Converts basis points to percentage for display.
 *
 * @param basisPoints - Basis points value
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string
 */
export function basisPointsToPercentage(basisPoints: number, decimals: number = 2): string {
  const percentage = (basisPoints / TOTAL_BASIS_POINTS) * 100;
  return percentage.toFixed(decimals);
}

/**
 * Converts percentage to basis points.
 *
 * @param percentage - Percentage value
 * @returns Basis points (rounded to nearest integer)
 */
export function percentageToBasisPoints(percentage: number): number {
  return Math.round((percentage / 100) * TOTAL_BASIS_POINTS);
}
