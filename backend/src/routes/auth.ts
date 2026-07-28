import { Request, Response, Router } from 'express';
import { challengesService } from '../services/challenges.js';
import { isValidStellarAddress, stellarSignatureVerifier } from '../utils/stellar.js';
import { signToken } from '../utils/jwt.js';

const router: Router = Router();

interface ChallengeRequest {
  address?: string;
}

interface VerifyRequest {
  address?: string;
  nonce?: string;
  signature?: string;
}

/**
 * POST /auth/challenge
 * Issues a unique, single-use, time-bound nonce for a wallet address.
 * The client must sign the returned `message` verbatim and submit it to /auth/verify.
 */
router.post('/challenge', async (req: Request, res: Response) => {
  const { address } = req.body as ChallengeRequest;

  if (!address || typeof address !== 'string' || !isValidStellarAddress(address)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'A valid Stellar wallet "address" is required.',
      },
    });
  }

  const challenge = await challengesService.create(address);

  return res.status(200).json({
    success: true,
    data: {
      address: challenge.address,
      nonce: challenge.nonce,
      message: challenge.message,
      expiresAt: challenge.expiresAt.toISOString(),
    },
  });
});

/**
 * POST /auth/verify
 * Verifies a signed challenge against the wallet's public key and issues a JWT.
 */
router.post('/verify', async (req: Request, res: Response) => {
  const { address, nonce, signature } = req.body as VerifyRequest;

  if (
    !address ||
    typeof address !== 'string' ||
    !nonce ||
    typeof nonce !== 'string' ||
    !signature ||
    typeof signature !== 'string'
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Fields "address", "nonce", and "signature" are required.',
      },
    });
  }

  if (!isValidStellarAddress(address)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'A valid Stellar wallet "address" is required.',
      },
    });
  }

  const challenge = await challengesService.consume(address, nonce);
  if (!challenge) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Challenge not found, already used, or expired.',
      },
    });
  }

  const isValidSignature = stellarSignatureVerifier.verify(address, challenge.message, signature);
  if (!isValidSignature) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid signature.',
      },
    });
  }

  const token = signToken({ sub: address, address });

  return res.status(200).json({
    success: true,
    data: {
      token,
      address,
    },
  });
});

export default router;
