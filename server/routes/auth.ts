import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/prisma.js';

export const router = Router();
export const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-duochat-key';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

// Middleware to authenticate JWT
export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role: string };
    req.user = payload;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
}

// 1. Register User
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // First user is Admin, others are pending
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? 'admin' : 'user';
    const status = userCount === 0 ? 'approved' : 'pending';

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role,
        status,
      },
    });

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Login User
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.status !== 'approved') {
      return res.status(403).json({
        error: 'Your account is pending approval by the chat administrator.',
        status: user.status,
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
        hasPublicKey: !!user.publicKey,
        mood: user.mood,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Get Current User Profile
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
      hasPublicKey: !!user.publicKey,
      mood: user.mood,
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Admin - List All Users (for approval panel)
router.get('/admin/users', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access only' });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(users);
  } catch (error) {
    console.error('Admin users fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. Admin - Approve/Reject User
router.post('/admin/approve', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access only' });
    }

    const { userId, status } = req.body; // status: 'approved' | 'rejected'
    if (!userId || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Valid userId and status are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
      }
    });

    return res.json({ message: `User status set to ${status}`, user: updatedUser });
  } catch (error) {
    console.error('Admin approve error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Get Other Room Member User (to display in E2EE chat list)
router.get('/chat-partner', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    
    // Find first user who is approved and is NOT current user
    const partner = await prisma.user.findFirst({
      where: {
        id: { not: req.user.id },
        status: 'approved'
      },
      select: {
        id: true,
        username: true,
        publicKey: true,
        mood: true,
      }
    });

    return res.json(partner || null);
  } catch (error) {
    console.error('Chat partner fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 7. Update Current User Mood
router.put('/mood', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { mood } = req.body;
    if (typeof mood !== 'string') {
      return res.status(400).json({ error: 'Invalid mood data' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { mood },
      select: {
        id: true,
        username: true,
        mood: true
      }
    });

    return res.json({ message: 'Mood updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Mood update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
