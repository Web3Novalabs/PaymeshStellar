import { type GroupMember } from '../types/index.js';

export interface MemberValidationError {
  code: 'BAD_REQUEST';
  message: string;
}

export function validateMembers(members: unknown[]): MemberValidationError | null {
  let totalSplit = 0;

  for (const member of members) {
    if (
      !member ||
      typeof (member as Record<string, unknown>).address !== 'string' ||
      typeof (member as Record<string, unknown>).name !== 'string' ||
      typeof (member as Record<string, unknown>).percentage !== 'number'
    ) {
      return {
        code: 'BAD_REQUEST',
        message: 'Invalid member format. Each member must have address, name, and percentage.',
      };
    }

    const pct = (member as GroupMember).percentage;

    if (!Number.isFinite(pct) || pct <= 0) {
      return {
        code: 'BAD_REQUEST',
        message: 'Each member percentage must be a positive finite number.',
      };
    }

    totalSplit += pct;
  }

  if (Math.round(totalSplit) !== 100) {
    return {
      code: 'BAD_REQUEST',
      message: `Member percentage splits must total 100%. Current total: ${totalSplit}%`,
    };
  }

  return null;
}
