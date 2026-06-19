import { Response, Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { groupsService } from '../services/groups.js';
import { isValidStellarAddress } from '../utils/stellar.js';
import { validateMembers } from '../utils/validateMembers.js';
import { serializeGroup } from '../utils/serializeGroup.js';

const router: Router = Router();

function parsePaginationParam(value: unknown, defaultValue: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : defaultValue;
}

/**
 * POST /api/groups
 * Create a new payroll group. Requires authentication.
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { groupId, name, paymentToken, members } = req.body;
  const creator = req.user!.publicKey;

  if (!groupId || !name || !paymentToken || !Array.isArray(members)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Missing required fields: groupId, name, paymentToken, and members are required.',
      },
    });
  }

  const memberError = validateMembers(members);
  if (memberError) {
    return res.status(400).json({ success: false, error: memberError });
  }

  try {
    const group = await groupsService.create({ groupId, name, creator, paymentToken, members });
    return res.status(201).json({ success: true, data: serializeGroup(group) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create group.';
    return res
      .status(500)
      .json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } });
  }
});

/**
 * GET /api/groups
 * List payroll groups with pagination. Requires authentication.
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const creator = req.user!.publicKey;
  const creatorFilter = req.query.creator as string | undefined;

  if (creatorFilter) {
    if (!isValidStellarAddress(creatorFilter)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message:
            'Missing required fields: groupId, name, paymentToken, and members are required.',
        },
      });
    }
    if (creatorFilter !== creator) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. You can only read your own groups.' },
      });
    }
  }

  const limit = Math.min(parsePaginationParam(req.query.limit, 10), 100);
  const offset = parsePaginationParam(req.query.offset, 0);

  try {
    const result = await groupsService.list({ limit, offset, creator: creatorFilter ?? creator });
    return res.status(200).json({
      success: true,
      data: {
        groups: result.groups.map(serializeGroup),
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
    return res
      .status(500)
      .json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } });
  }
});

/**
 * GET /api/groups/:id
 * Retrieve a specific group. Requires authentication; creator-only access.
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const creator = req.user!.publicKey;

  try {
    const group = await groupsService.getById(id);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Group not found.' },
      });
    }

    if (group.creator !== creator) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message,
        },
      });
    }

    return res.status(200).json({ success: true, data: serializeGroup(group) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve group.';
    return res
      .status(500)
      .json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } });
  }
});

/**
 * PUT /api/groups/:id
 * Update an existing group. Requires authentication; creator-only.
 */
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, paymentToken, members } = req.body;
  const creator = req.user!.publicKey;

  try {
    const group = await groupsService.getById(id);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Group not found.' },
      });
    }

    if (group.creator !== creator) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message,
        },
      });
    }
  })
);

    const updates: Parameters<typeof groupsService.update>[1] = {};

    try {
      const group = await groupsService.getById(id);

      if (!group) {
        return res.status(404).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Members must be an array.' },
        });
      }

      const memberError = validateMembers(members);
      if (memberError) {
        return res.status(400).json({ success: false, error: memberError });
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

    const updatedGroup = await groupsService.update(id, updates);

    if (!updatedGroup) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update group.' },
      });
    }

    return res.status(200).json({ success: true, data: serializeGroup(updatedGroup) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update group.';
    return res
      .status(500)
      .json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } });
  }
});

export default router;
