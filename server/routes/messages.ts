import { Router, Response } from 'express';
import { prisma } from '../database/prisma.js';
import { authenticateJWT, AuthenticatedRequest } from './auth.js';

export const router = Router();

// Fetch message history between logged in user and partner
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Since this is a 2-person room, we retrieve any message sent by or received by this user
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user.id },
          { recipientId: req.user.id }
        ]
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    return res.json(messages);
  } catch (error) {
    console.error('Fetch messages error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete (unsend) a message
router.delete('/:messageId', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { messageId } = req.params;

    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Cannot delete other users\' messages' });
    }

    await prisma.message.delete({
      where: { id: messageId }
    });

    return res.json({ success: true, messageId });
  } catch (error) {
    console.error('Delete message error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
