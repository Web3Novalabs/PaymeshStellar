import { Response, Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { usersService, User } from '../services/users.js';
import { validate } from '../middleware/validate.js';
import { CreateUserSchema, UpdateUserSchema, GetUserSchema } from '../schemas/userSchemas.js';

const router: Router = Router();

interface UserResponse {
  id: string;
  address: string;
  name: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

function userToResponse(user: User): UserResponse {
  return {
    id: user.id,
    address: user.address,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * POST /api/users
 * Create a new user profile linked to the authenticated wallet address.
 * One profile per address (duplicate → 409).
 */
router.post(
  '/',
  requireAuth,
  validate(CreateUserSchema),
  async (req: AuthenticatedRequest, res: Response<ApiResponse<UserResponse>>) => {
    const address = req.user?.publicKey;
    const { name, email } = req.body;

    if (!address) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    // Check if user already exists for this address
    const existing = await usersService.getByAddress(address);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A profile already exists for this address.',
        },
      });
    }

    try {
      const user = await usersService.create({
        address,
        name: name.trim(),
        email: email?.trim(),
      });

      return res.status(201).json({
        success: true,
        data: userToResponse(user),
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create user profile.',
        },
      });
    }
  }
);

/**
 * GET /api/users/me
 * Retrieve the current authenticated user's profile.
 * Must be defined BEFORE the /:id route to match correctly.
 */
router.get(
  '/me',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response<ApiResponse<UserResponse>>) => {
    const address = req.user?.publicKey;

    if (!address) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    try {
      const user = await usersService.getByAddress(address);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User profile not found for authenticated address.',
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: userToResponse(user),
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve user profile.',
        },
      });
    }
  }
);

/**
 * GET /api/users/:id
 * Retrieve a user profile by ID.
 */
router.get('/:id', validate(GetUserSchema), async (req: AuthenticatedRequest, res: Response<ApiResponse<UserResponse>>) => {
  const { id } = req.params;

  try {
    const user = await usersService.getById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User profile not found.',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: userToResponse(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve user profile.',
      },
    });
  }
});

/**
 * PUT /api/users/:id
 * Update a user profile. Only the owner can update their profile.
 */
router.put(
  '/:id',
  requireAuth,
  validate(UpdateUserSchema),
  async (req: AuthenticatedRequest, res: Response<ApiResponse<UserResponse>>) => {
    const address = req.user?.publicKey;
    const { id } = req.params;
    const { name, email } = req.body;

    if (!address) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    try {
      const user = await usersService.getById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User profile not found.',
          },
        });
      }

      // Ensure user can only update their own profile
      if (user.address !== address) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only update your own profile.',
          },
        });
      }

      const updateData: Partial<Omit<User, 'id' | 'address' | 'createdAt'>> = {};
      if (name !== undefined) {
        updateData.name = name.trim();
      }
      if (email !== undefined) {
        updateData.email = email === null ? undefined : email.trim();
      }

      const updated = await usersService.update(id, updateData);

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User profile not found.',
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: userToResponse(updated),
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update user profile.',
        },
      });
    }
  }
);

export default router;
