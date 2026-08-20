import { z } from 'zod';
import { isValidStellarAddress } from '../utils/stellar.js';
import { validateMembers } from '../utils/validateMembers.js';

export const CreateGroupSchema = z.object({
  body: z.object({
    groupId: z.string().min(1, 'groupId is required'),
    name: z.string().min(1, 'name is required'),
    paymentToken: z.string().min(1, 'paymentToken is required'),
    members: z
      .array(
        z.object({
          address: z.string().refine(isValidStellarAddress, 'Invalid Stellar address'),
          percentage: z.number().positive().max(100),
        })
      )
      .refine((members) => validateMembers(members) === null, 'Invalid members')
  })
});

export const ListGroupsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().min(0).max(100).default(10),
    offset: z.coerce.number().min(0).default(0),
    creator: z.string().refine(isValidStellarAddress, 'Invalid creator address').optional(),
  })
});

export const GetGroupSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid group ID format'),
  })
});

export const UpdateGroupSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid group ID format'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    paymentToken: z.string().min(1).optional(),
    members: z
      .array(
        z.object({
          address: z.string().refine(isValidStellarAddress, 'Invalid Stellar address'),
          percentage: z.number().positive().max(100),
        })
      )
      .optional()
      .refine((members) => {
        if (!members) return true;
        return validateMembers(members) === null;
      }, 'Invalid members')
  })
});
