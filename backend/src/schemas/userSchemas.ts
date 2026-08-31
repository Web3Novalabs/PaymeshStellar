import { z } from 'zod';

export const CreateUserSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'Field "name" is required and must be a non-empty string.'),
      email: z.string().email('Field "email" must be a valid RFC email address.').optional(),
    })
    .strict(),
});

export const UpdateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID format'),
  }),
  body: z
    .object({
      name: z.string().trim().min(1, 'Field "name" must be a non-empty string.').optional(),
      email: z
        .string()
        .email('Field "email" must be a valid RFC email address.')
        .optional()
        .nullable(),
    })
    .strict(),
});

export const GetUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID format'),
  }),
});
