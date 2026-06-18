import { Response, Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { transactionDataSource, TransactionFilter } from '../services/transactions.js';
import { groupsService } from '../services/groups.js';

const router: Router = Router();

// Stellar address validation regex (G... format, 56 characters, Base32 alphabet)
const STELLAR_ADDRESS_REGEX = /^G[A-D2-7][A-Z2-7]{54}$/;

function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(address);
}

/**
 * GET /api/transactions
 * Retrieve paginated transaction history for payroll groups.
 * Requires authentication and access to the group.
 *
 * Query parameters:
 *   - group_id: Filter by group ID (required to list transactions)
 *   - member: Filter by member address (must be valid Stellar address)
 *   - order: Sort by date, 'asc' or 'desc' (default: desc)
 *   - limit: Pagination limit, max 100 (default: 10)
 *   - cursor: Pagination cursor from previous response
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userAddress = req.user?.publicKey;
  if (!userAddress) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      },
    });
  }

  // Validate query parameters
  const { group_id, member, order, limit: limitStr, cursor } = req.query;

  // group_id is required
  if (!group_id || typeof group_id !== 'string' || group_id.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Query parameter "group_id" is required and must be a non-empty string.',
      },
    });
  }

  // Validate and parse limit
  let limit = 10;
  if (limitStr !== undefined) {
    if (typeof limitStr !== 'string' || !/^\d+$/.test(limitStr)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Query parameter "limit" must be a positive integer.',
        },
      });
    }
    limit = parseInt(limitStr, 10);
    if (limit < 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Query parameter "limit" must be at least 1.',
        },
      });
    }
    if (limit > 100) {
      limit = 100; // Cap at 100
    }
  }

  // Validate order parameter
  if (order !== undefined && order !== 'asc' && order !== 'desc') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Query parameter "order" must be "asc" or "desc".',
      },
    });
  }

  // Validate member address if provided
  if (member !== undefined) {
    if (typeof member !== 'string' || !isValidStellarAddress(member)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Query parameter "member" must be a valid Stellar address.',
        },
      });
    }
  }

  // Check if user has access to this group
  // User can access if they are the creator or a member
  const group = await groupsService.getByGroupId(group_id);
  if (!group) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied. Group not found or you do not have permission to access it.',
      },
    });
  }

  const isCreator = group.creator === userAddress;
  const isMember = group.members.some((m) => m.address === userAddress);

  if (!isCreator && !isMember) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied. You do not belong to this group.',
      },
    });
  }

  // Build filter
  const filter: TransactionFilter = {
    groupId: group_id,
    memberAddress: member as string | undefined,
    order: (order as 'asc' | 'desc') || 'desc',
    limit,
    cursor: cursor as string | undefined,
  };

  try {
    const result = await transactionDataSource.getTransactions(filter);

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        limit: result.limit,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve transactions.',
      },
    });
  }
});

export default router;
