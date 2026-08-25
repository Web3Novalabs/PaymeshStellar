import { NextFunction, Response, Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { reconciliationService } from '../services/reconcile.js';

const router: Router = Router();

// Ensure the endpoint is admin-gated.
// Assuming there's some role-check we can do. For now we will check if the user is an admin.
// If the app doesn't have an admin role in the User model, we'll check against an ADMIN_ADDRESS env var.
const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const adminAddress = process.env.ADMIN_ADDRESS;
  if (!adminAddress || req.user?.publicKey !== adminAddress) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required.' },
    });
    return;
  }
  return next();
};

router.get(
  '/reconcile',
  requireAuth,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    const groupId = req.query.group_id as string | undefined;

    try {
      if (groupId) {
        const report = await reconciliationService.reconcileGroup(groupId);
        return res
          .status(200)
          .json({ success: true, data: report || { message: 'No drift detected' } });
      } else {
        const report = await reconciliationService.reconcileAll();
        return res.status(200).json({ success: true, data: report });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reconciliation failed.';
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } });
    }
  }
);

export default router;
