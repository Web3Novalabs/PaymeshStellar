import { z } from 'zod';
import { isValidStellarAddress } from '../utils/stellar.js';

export const ListTransactionsSchema = z.object({
  query: z.object({
    group_id: z.string().min(1, 'Query parameter "group_id" is required and must be a non-empty string.'),
    limit: z.coerce.number().min(1, 'Query parameter "limit" must be at least 1.').max(100).default(10),
    cursor: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
    member: z.string().refine(isValidStellarAddress, 'Query parameter "member" must be a valid Stellar address.').optional(),
  })
});
