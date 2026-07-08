import { Router, Response } from 'express';
import { prisma } from '../database/prisma.js';
import { authenticateJWT, AuthenticatedRequest } from './auth.js';

export const router = Router();

// 1. Upload User's Public Key Bundle
router.post('/keys', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { publicKeyBundle } = req.body; // string or JSON structure containing ECDH public keys

    if (!publicKeyBundle) {
      return res.status(400).json({ error: 'publicKeyBundle is required' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { publicKey: typeof publicKeyBundle === 'string' ? publicKeyBundle : JSON.stringify(publicKeyBundle) }
    });

    return res.json({ message: 'Public key bundle uploaded successfully' });
  } catch (error) {
    console.error('Keys upload error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Fetch User's Public Key Bundle
router.get('/keys/:userId', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { publicKey: true }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.publicKey) return res.status(404).json({ error: 'Public key bundle not found for this user' });

    return res.json({ publicKeyBundle: JSON.parse(user.publicKey) });
  } catch (error) {
    console.error('Keys fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
