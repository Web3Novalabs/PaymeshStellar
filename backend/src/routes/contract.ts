import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sorobanService } from '../services/soroban.js';
import { groupsService } from '../services/groups.js';
import { groupIdToScVal } from '../utils/scval.js';

const router: Router = Router();

/**
 * POST /api/contract/groups/:id/distribute/prepare
 * Prepares an unsigned distribution transaction.
 */
router.post(
  '/groups/:id/distribute/prepare',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user!;

    try {
      const group = await groupsService.getById(id);
      if (!group) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Group not found.' },
        });
      }

      if (group.creator !== user.publicKey) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. You can only manage distributions for your own groups.',
          },
        });
      }

      const args = [groupIdToScVal(group.groupId)];

      // Hardcoded to distribute for now as required.
      const prep = await sorobanService.prepareTransaction(user.publicKey, 'distribute', args);

      return res.status(200).json({
        success: true,
        data: {
          xdr: prep.xdr,
          simulation: {
            minResourceFee: prep.minResourceFee,
            events: prep.events,
          },
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'SorobanSimulationError') {
        return res.status(400).json({
          success: false,
          error: {
            code: (error as unknown as Record<string, unknown>).variant,
            message: error.message,
          },
        });
      }

      const message = error instanceof Error ? error.message : 'Failed to prepare transaction.';
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message },
      });
    }
  }
);

/**
 * POST /api/contract/tx/submit
 * Submits a signed XDR to the network.
 */
router.post('/tx/submit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { xdr: signedXdr } = req.body;

  if (!signedXdr || typeof signedXdr !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Missing or malformed XDR string.' },
    });
  }

  try {
    const result = await sorobanService.submit(signedXdr);

    if (result.status === 'SUCCESS') {
      return res.status(200).json({
        success: true,
        data: result,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TRANSACTION_FAILED',
          message: result.error || 'Transaction failed on network.',
        },
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    // Determine if malformed XDR
    if (err.message && err.message.includes('XDR')) {
      return res.status(400).json({
        success: false,
        error: { code: 'MALFORMED_XDR', message: 'The provided XDR is malformed or invalid.' },
      });
    }

    const message = error instanceof Error ? error.message : 'Failed to submit transaction.';
    const isRetriable = message.includes('(Retriable)');

    return res.status(isRetriable ? 503 : 400).json({
      success: false,
      error: {
        code: isRetriable ? 'TRY_AGAIN_LATER' : 'SUBMISSION_ERROR',
        message: message.replace(/\s\([^)]+\)$/, ''), // clean up internal marker
      },
    });
  }
});

export default router;
