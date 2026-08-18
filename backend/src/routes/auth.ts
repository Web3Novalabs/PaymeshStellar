import { Request, Response, Router } from 'express';
import { TransactionBuilder } from '@stellar/stellar-sdk';
import { authConfig } from '../config/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { challengesService } from '../services/challenges.js';
import { sessionsService, type IssuedSession } from '../services/sessions.js';
import { verifySep10Challenge } from '../services/sep10.js';
import { isValidStellarAddress } from '../utils/stellar.js';
import { signToken } from '../utils/jwt.js';

const router: Router = Router();
const REFRESH_COOKIE = 'paymesh_refresh';

function unauthorized(res: Response, message = 'Invalid or expired authentication credential.') {
  return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message },
  });
}

function cookieValue(req: Request, name: string): string | undefined {
  const cookies = req.headers.cookie?.split(';') ?? [];
  for (const cookie of cookies) {
    const [key, ...parts] = cookie.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(parts.join('='));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function setRefreshCookie(res: Response, session: IssuedSession): void {
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    path: '/auth',
    maxAge: Math.max(0, session.expiresAt.getTime() - Date.now()),
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    path: '/auth',
  });
}

function authResponse(res: Response, session: IssuedSession) {
  const accessToken = signToken({
    sub: session.publicKey,
    address: session.publicKey,
    sid: session.id,
  });
  setRefreshCookie(res, session);
  return res.status(200).json({
    success: true,
    data: {
      token: accessToken,
      accessToken,
      address: session.publicKey,
      expiresIn: authConfig().accessTtlSeconds,
    },
  });
}

router.post(
  '/challenge',
  asyncHandler(async (req: Request, res: Response) => {
    const address = (req.body as { address?: unknown }).address;
    if (typeof address !== 'string' || !isValidStellarAddress(address)) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'A valid Stellar wallet "address" is required.' },
      });
      return;
    }

    const challenge = await challengesService.create(address);
    res.status(200).json({
      success: true,
      data: {
        address,
        transaction: challenge.transaction,
        xdr: challenge.transaction,
        networkPassphrase: authConfig().networkPassphrase,
        expiresAt: challenge.expiresAt.toISOString(),
      },
    });
  })
);

router.post(
  '/verify',
  asyncHandler(async (req: Request, res: Response) => {
    const transaction =
      (req.body as { transaction?: unknown; xdr?: unknown }).transaction ??
      (req.body as { xdr?: unknown }).xdr;
    if (typeof transaction !== 'string' || transaction.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'A signed SEP-10 "transaction" XDR is required.' },
      });
      return;
    }

    try {
      const tx = TransactionBuilder.fromXDR(transaction, authConfig().networkPassphrase);
      const firstOperation = tx.operations[0];
      if (!firstOperation || firstOperation.type !== 'manageData' || !firstOperation.value) {
        unauthorized(res);
        return;
      }
      const nonce = firstOperation.value.toString('utf8');
      const challenge = await challengesService.find(nonce);
      if (!challenge || challenge.usedAt || challenge.expiresAt.getTime() <= Date.now()) {
        unauthorized(res, 'Challenge not found, already used, or expired.');
        return;
      }
      const publicKey = await verifySep10Challenge(transaction, challenge);
      if (!(await challengesService.consume(challenge.id))) {
        unauthorized(res, 'Challenge not found, already used, or expired.');
        return;
      }
      authResponse(res, await sessionsService.create(publicKey));
    } catch {
      unauthorized(res);
    }
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = cookieValue(req, REFRESH_COOKIE);
    if (!refreshToken) {
      unauthorized(res, 'Refresh token is required.');
      return;
    }
    const result = await sessionsService.rotate(refreshToken);
    if (result.status !== 'ok') {
      clearRefreshCookie(res);
      unauthorized(
        res,
        result.status === 'reuse'
          ? 'Refresh token reuse detected; the session family was revoked.'
          : 'Invalid or expired refresh token.'
      );
      return;
    }
    authResponse(res, result.session);
  })
);

router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = cookieValue(req, REFRESH_COOKIE);
    if (refreshToken) await sessionsService.logout(refreshToken);
    clearRefreshCookie(res);
    res.status(200).json({ success: true, data: { loggedOut: true } });
  })
);

router.post(
  '/logout-all',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await sessionsService.logoutAll(req.user!.publicKey);
    clearRefreshCookie(res);
    res.status(200).json({ success: true, data: { loggedOut: true } });
  })
);

export default router;
