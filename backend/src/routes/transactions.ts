import { Response, Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { transactionDataSource, TransactionFilter } from '../services/transactions.js';
import { groupsService } from '../services/groups.js';
import { validate } from '../middleware/validate.js';
import { ListTransactionsSchema } from '../schemas/transactionSchemas.js';

const router: Router = Router();

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
router.get(
  '/',
  requireAuth,
  validate(ListTransactionsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
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

    const group_id_str = group_id as string;
    const limit = Number(limitStr);

    // Check if user has access to this group
    // User can access if they are the creator or a member
    const group = await groupsService.getByGroupId(group_id_str);
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
      groupId: group_id_str,
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
  }
);

export default router;
