import { Router } from 'express';
import prisma from '../config/database';

const router = Router();

// DEV ONLY: Get verification code for testing
router.get('/get-verification-code/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const pendingUser = await prisma.pendingUser.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        email: true,
        emailCode: true,
        expiresAt: true,
        emailVerified: true,
      }
    });

    if (!pendingUser) {
      return res.status(404).json({ error: 'No pending user found' });
    }

    res.json({
      email: pendingUser.email,
      code: pendingUser.emailCode,
      expiresAt: pendingUser.expiresAt,
      verified: pendingUser.emailVerified
    });
  } catch (error) {
    console.error('Error getting verification code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
