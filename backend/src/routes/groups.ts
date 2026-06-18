import { Response, Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { Group, groupsService } from '../services/groups.js';

const router: Router = Router();

// Stellar address validation regex (G... format, 56 characters, Base32 alphabet)
const STELLAR_ADDRESS_REGEX = /^G[A-D2-7][A-Z2-7]{54}$/;

function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(address);
}

/**
 * POST /api/groups
 * Create a new payroll group.
 * Requires authentication.
 */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { groupId, name, paymentToken, members } = req.body;
    const creator = req.user?.publicKey;

    if (!creator) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    // Basic validation
    if (!groupId || !name || !paymentToken || !Array.isArray(members)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message:
            'Missing required fields: groupId, name, paymentToken, and members are required.',
        },
      });
    }

    // Validate members structure and split percentage
    let totalSplit = 0;
    for (const member of members) {
      if (
        !member ||
        typeof member.address !== 'string' ||
        typeof member.name !== 'string' ||
        typeof member.percentage !== 'number'
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid member format. Each member must have address, name, and percentage.',
          },
        });
      }
      totalSplit += member.percentage;
    }

    if (totalSplit !== 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `Member percentage splits must total 100%. Current total: ${totalSplit}%`,
        },
      });
    }

    try {
      const group = await groupsService.create({
        groupId,
        name,
        creator,
        paymentToken,
        members,
      });

      return res.status(201).json({
        success: true,
        data: {
          id: group.id,
          groupId: group.groupId,
          name: group.name,
          creator: group.creator,
          paymentToken: group.paymentToken,
          members: group.members,
          membersCount: group.membersCount,
          createdAt: group.createdAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create group.';
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message,
        },
      });
    }
  })
);

/**
 * GET /api/groups
 * List payroll groups with pagination.
 * Requires authentication, reads of owned data are access-checked.
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const creator = req.user?.publicKey;

    if (!creator) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    const creatorFilter = req.query.creator as string;

    // Validate creator address format if supplied
    if (creatorFilter) {
      if (!isValidStellarAddress(creatorFilter)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid Stellar address format for creator filter.',
          },
        });
      }

      // Access check: User can only read their own data
      if (creatorFilter !== creator) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. You can only read your own groups.',
          },
        });
      }
    }

    // Enforce pagination defaults and caps
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    try {
      // Only fetch groups owned by the authenticated creator
      const result = await groupsService.list({
        limit,
        offset,
        creator: creatorFilter || creator, // default to authenticated user's groups
      });

      return res.status(200).json({
        success: true,
        data: {
          groups: result.groups.map((group) => ({
            id: group.id,
            groupId: group.groupId,
            name: group.name,
            creator: group.creator,
            paymentToken: group.paymentToken,
            members: group.members,
            membersCount: group.membersCount,
            createdAt: group.createdAt,
          })),
          pagination: {
            total: result.totalCount,
            limit,
            offset,
            hasMore: offset + limit < result.totalCount,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list groups.';
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message,
        },
      });
    }
  })
);

/**
 * GET /api/groups/:id
 * Retrieve a specific group details.
 * Requires authentication; access checked for creator.
 */
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const creator = req.user?.publicKey;

    if (!creator) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    try {
      const group = await groupsService.getById(id);

      if (!group) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Group not found.',
          },
        });
      }

      // Access check: User must be the owner (creator) of this group
      if (group.creator !== creator) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. You do not have permission to read this group.',
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          id: group.id,
          groupId: group.groupId,
          name: group.name,
          creator: group.creator,
          paymentToken: group.paymentToken,
          members: group.members,
          membersCount: group.membersCount,
          createdAt: group.createdAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve group.';
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message,
        },
      });
    }
  })
);

/**
 * PUT /api/groups/:id
 * Update an existing group.
 * Requires authentication; creator-only check.
 */
router.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { name, paymentToken, members } = req.body;
    const creator = req.user?.publicKey;

    if (!creator) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    try {
      const group = await groupsService.getById(id);

      if (!group) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Group not found.',
          },
        });
      }

      // Access check: only the owner can edit
      if (group.creator !== creator) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. You do not have permission to modify this group.',
          },
        });
      }

      const updates: Partial<Omit<Group, 'id' | 'createdAt'>> = {};

      if (name !== undefined) updates.name = name;
      if (paymentToken !== undefined) updates.paymentToken = paymentToken;

      if (members !== undefined) {
        if (!Array.isArray(members)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'BAD_REQUEST',
              message: 'Members must be an array.',
            },
          });
        }

        let totalSplit = 0;
        for (const member of members) {
          if (
            !member ||
            typeof member.address !== 'string' ||
            typeof member.name !== 'string' ||
            typeof member.percentage !== 'number'
          ) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'BAD_REQUEST',
                message:
                  'Invalid member format. Each member must have address, name, and percentage.',
              },
            });
          }
          totalSplit += member.percentage;
        }

        if (totalSplit !== 100) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'BAD_REQUEST',
              message: `Member percentage splits must total 100%. Current total: ${totalSplit}%`,
            },
          });
        }

        updates.members = members;
      }

      const updatedGroup = await groupsService.update(id, updates);

      return res.status(200).json({
        success: true,
        data: {
          id: updatedGroup?.id,
          groupId: updatedGroup?.groupId,
          name: updatedGroup?.name,
          creator: updatedGroup?.creator,
          paymentToken: updatedGroup?.paymentToken,
          members: updatedGroup?.members,
          membersCount: updatedGroup?.membersCount,
          createdAt: updatedGroup?.createdAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update group.';
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message,
        },
      });
    }
  })
);

export default router;
