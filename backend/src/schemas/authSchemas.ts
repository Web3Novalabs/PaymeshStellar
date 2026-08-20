import { z } from 'zod';
import { isValidStellarAddress } from '../utils/stellar.js';

export const AuthChallengeSchema = z.object({
  body: z.object({
    address: z.string().refine(isValidStellarAddress, 'A valid Stellar wallet "address" is required.'),
  }).strict(),
});

export const AuthVerifySchema = z.object({
  body: z.object({
    transaction: z.string().min(1, 'A signed SEP-10 "transaction" XDR is required.').optional(),
    xdr: z.string().min(1, 'A signed SEP-10 "transaction" XDR is required.').optional(),
  }).refine((data) => data.transaction || data.xdr, 'A signed SEP-10 "transaction" XDR is required.')
});
