import { Response, Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { groupsService } from '../services/groups.js';
import { serializeGroup } from '../utils/serializeGroup.js';
import { validate } from '../middleware/validate.js';
import { CreateGroupSchema, ListGroupsSchema, GetGroupSchema, UpdateGroupSchema } from '../schemas/groupSchemas.js';

const router: Router = Router();

/**
 * POST /api/groups
 * Create a new payroll group. Requires authentication.
 */
router.post('/', requireAuth, validate(CreateGroupSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { groupId, name, paymentToken, members } = req.body;
  const creator = req.user!.publicKey;

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
router.get('/', requireAuth, validate(ListGroupsSchema), async (req: AuthenticatedRequest, res: Response) => {
  const creator = req.user!.publicKey;
  const creatorFilter = req.query.creator as string | undefined;

  if (creatorFilter && creatorFilter !== creator) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied. You can only read your own groups.' },
    });
  }

  const limit = Number(req.query.limit);
  const offset = Number(req.query.offset);

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
router.get('/:id', requireAuth, validate(GetGroupSchema), async (req: AuthenticatedRequest, res: Response) => {
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
          code: 'FORBIDDEN',
          message: 'Access denied. You can only read your own groups.',
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
router.put('/:id', requireAuth, validate(UpdateGroupSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, paymentToken, members } = req.body;
  const creator = req.user!.publicKey;

  const updates: Parameters<typeof groupsService.update>[1] = {};

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
          code: 'FORBIDDEN',
          message: 'Access denied. You can only update your own groups.',
        },
      });
    }

    if (name !== undefined) updates.name = name;
    if (paymentToken !== undefined) updates.paymentToken = paymentToken;
    if (members !== undefined) updates.members = members;

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
