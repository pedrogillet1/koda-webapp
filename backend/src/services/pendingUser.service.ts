import prisma from '../config/database';

/**
 * Pending User Service
 * Handles user registration pending verification using database
 */
class PendingUserService {
  async createPendingUser(data: { email: string; passwordHash: string; salt: string }): Promise<{ pendingUser: any; emailCode: string }> {
    const normalizedEmail = data.email.toLowerCase();

    // Generate a 6-digit verification code
    const emailCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Delete any existing pending user with this email
    await prisma.pendingUser.deleteMany({
      where: { email: normalizedEmail },
    });

    // Create pending user in database
    const pendingUser = await prisma.pendingUser.create({
      data: {
        email: normalizedEmail,
        passwordHash: data.passwordHash,
        salt: data.salt,
        emailCode,
        expiresAt,
      },
    });

    console.log('[PENDING USER] Created pending user:', data.email);
    console.log('[PENDING USER] Email verification code:', emailCode);

    return { pendingUser, emailCode };
  }

  async addPhoneToPending(email: string, phoneNumber: string): Promise<{ pendingUser: any; phoneCode: string }> {
    const normalizedEmail = email.toLowerCase();

    // Find pending user by email
    const pendingUser = await prisma.pendingUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!pendingUser) {
      throw new Error('Pending user not found. Please start registration first.');
    }

    // Generate a 6-digit phone verification code
    const phoneCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Update pending user with phone number
    const updatedUser = await prisma.pendingUser.update({
      where: { email: normalizedEmail },
      data: {
        phoneNumber,
        phoneCode,
      },
    });

    console.log('[PENDING USER] Added phone to pending user:', email);
    console.log('[PENDING USER] Phone verification code:', phoneCode);

    return { pendingUser: updatedUser, phoneCode };
  }

  async create(data: any): Promise<any> {
    console.log('[PENDING USER] Created pending user:', data.email);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Delete any existing pending user with this email
    await prisma.pendingUser.deleteMany({
      where: { email: data.email.toLowerCase() },
    });

    return await prisma.pendingUser.create({
      data: {
        ...data,
        email: data.email.toLowerCase(),
        expiresAt,
      },
    });
  }

  async findByEmail(email: string): Promise<any | null> {
    const normalizedEmail = email.toLowerCase();
    return await prisma.pendingUser.findUnique({
      where: { email: normalizedEmail },
    });
  }

  async findByToken(token: string): Promise<any | null> {
    // Search for pending user by email or phone code
    const users = await prisma.pendingUser.findMany({
      where: {
        OR: [
          { emailCode: token },
          { phoneCode: token },
        ],
      },
    });

    return users.length > 0 ? users[0] : null;
  }

  async delete(id: string): Promise<void> {
    console.log('[PENDING USER] Deleted pending user:', id);

    // Try to delete by id first, then by email
    try {
      await prisma.pendingUser.delete({
        where: { id },
      });
    } catch (error) {
      // If not found by id, try by email
      await prisma.pendingUser.delete({
        where: { email: id.toLowerCase() },
      });
    }
  }

  async deletePendingUser(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    console.log('[PENDING USER] Deleting pending user:', normalizedEmail);

    await prisma.pendingUser.deleteMany({
      where: { email: normalizedEmail },
    });
  }

  async verifyPendingEmail(email: string, code: string): Promise<any> {
    const normalizedEmail = email.toLowerCase();

    const pendingUser = await prisma.pendingUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!pendingUser) {
      throw new Error('Pending user not found');
    }

    if (pendingUser.emailCode !== code) {
      throw new Error('Invalid verification code');
    }

    if (pendingUser.expiresAt < new Date()) {
      throw new Error('Verification code expired');
    }

    // Mark email as verified
    const updatedUser = await prisma.pendingUser.update({
      where: { email: normalizedEmail },
      data: { emailVerified: true },
    });

    console.log('[PENDING USER] Email verified for:', normalizedEmail);
    return updatedUser;
  }

  async verifyPendingPhone(email: string, code: string): Promise<any> {
    const normalizedEmail = email.toLowerCase();

    const pendingUser = await prisma.pendingUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!pendingUser) {
      throw new Error('Pending user not found');
    }

    if (!pendingUser.phoneCode) {
      throw new Error('No phone verification code found');
    }

    if (pendingUser.phoneCode !== code) {
      throw new Error('Invalid verification code');
    }

    if (pendingUser.expiresAt < new Date()) {
      throw new Error('Verification code expired');
    }

    // Mark phone as verified
    const updatedUser = await prisma.pendingUser.update({
      where: { email: normalizedEmail },
      data: { phoneVerified: true },
    });

    console.log('[PENDING USER] Phone verified for:', normalizedEmail);
    return updatedUser;
  }

  async resendEmailCode(email: string): Promise<{ pendingUser: any; emailCode: string }> {
    const normalizedEmail = email.toLowerCase();

    const pendingUser = await prisma.pendingUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!pendingUser) {
      throw new Error('Pending user not found');
    }

    // Generate new email code
    const emailCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Reset expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Update pending user with new code and expiration
    const updatedUser = await prisma.pendingUser.update({
      where: { email: normalizedEmail },
      data: {
        emailCode,
        expiresAt,
      },
    });

    console.log('[PENDING USER] Resent email code for:', normalizedEmail);
    console.log('[PENDING USER] New email verification code:', emailCode);

    return { pendingUser: updatedUser, emailCode };
  }
}

export default new PendingUserService();
