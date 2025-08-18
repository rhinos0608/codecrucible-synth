/**
 * API Routes
 * Defines REST endpoints for user authentication and management
 */

import { Router, Request, Response } from 'express';
import { AuthService } from './auth-service';
import { User } from './user-model';
import { authMiddleware } from './middleware/auth-middleware';

const router = Router();
const authService = new AuthService(process.env.JWT_SECRET!);

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Register user
    const user = await authService.register(email, password);
    
    // Update user profile if provided
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    await user.save();

    // Return user data (excluding password)
    const { password: _, ...userResponse } = user;
    res.status(201).json({
      success: true,
      user: userResponse
    });

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const token = await authService.login(email, password);
    
    res.json({
      success: true,
      token,
      expiresIn: '24h'
    });

  } catch (error) {
    res.status(401).json({
      error: error.message
    });
  }
});

/**
 * GET /api/auth/profile
 * Get current user profile (requires authentication)
 */
router.get('/auth/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const { password: _, ...userProfile } = user;
    res.json({
      success: true,
      user: userProfile
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile information
 */
router.put('/auth/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Update fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    
    await user.save();

    const { password: _, ...userProfile } = user;
    res.json({
      success: true,
      user: userProfile
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;