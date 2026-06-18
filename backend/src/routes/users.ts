import { Response, Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { usersService, User } from '../services/users.js';

const router: Router = Router();

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

interface CreateUserRequest {
  name: string;
  email?: string;
  [key: string]: unknown;
}

interface UpdateUserRequest {
  name?: string;
  email?: string;
  [key: string]: unknown;
}

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
  async (req: AuthenticatedRequest, res: Response<ApiResponse<UserResponse>>) => {
    const address = req.user?.publicKey;
    const body = req.body as CreateUserRequest;

    if (!address) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    // Check for extra fields
    const allowedFields = new Set(['name', 'email']);
    const bodyKeys = Object.keys(body);
    const extraFields = bodyKeys.filter((key) => !allowedFields.has(key));
    if (extraFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `Unknown fields: ${extraFields.join(', ')}`,
        },
      });
    }

    // Validate name
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Field "name" is required and must be a non-empty string.',
        },
      });
    }

    // Validate email if provided
    if (body.email !== undefined) {
      if (typeof body.email !== 'string' || !isValidEmail(body.email)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Field "email" must be a valid RFC email address.',
          },
        });
      }
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
        name: body.name.trim(),
        email: body.email?.trim(),
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
router.get('/:id', async (req: AuthenticatedRequest, res: Response<ApiResponse<UserResponse>>) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'User ID is required.',
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
  async (req: AuthenticatedRequest, res: Response<ApiResponse<UserResponse>>) => {
    const address = req.user?.publicKey;
    const { id } = req.params;
    const body = req.body as UpdateUserRequest;

    if (!address) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'User ID is required.',
        },
      });
    }

    // Check for extra fields
    const allowedFields = new Set(['name', 'email']);
    const bodyKeys = Object.keys(body);
    const extraFields = bodyKeys.filter((key) => !allowedFields.has(key));
    if (extraFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `Unknown fields: ${extraFields.join(', ')}`,
        },
      });
    }

    // Validate name if provided
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Field "name" must be a non-empty string.',
          },
        });
      }
    }

    // Validate email if provided
    if (body.email !== undefined) {
      if (body.email === null || body.email === '') {
        // Allow clearing email
        body.email = undefined;
      } else if (typeof body.email !== 'string' || !isValidEmail(body.email)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Field "email" must be a valid RFC email address.',
          },
        });
      }
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

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) {
        updateData.name = body.name.trim();
      }
      if (body.email !== undefined) {
        updateData.email = body.email?.trim();
      }

      const updated = await usersService.update(
        id,
        updateData as Partial<Omit<User, 'id' | 'address' | 'createdAt'>>
      );

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
