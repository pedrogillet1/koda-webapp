/**
 * Pending User Service - Minimal Stub
 * Handles user registration pending verification
 */
class PendingUserService {
  async create(data: any): Promise<any> {
    console.log('[PENDING USER] Created pending user:', data.email);
    return { id: 'pending-' + Date.now(), ...data };
  }

  async findByEmail(email: string): Promise<any | null> {
    return null;
  }

  async findByToken(token: string): Promise<any | null> {
    return null;
  }

  async delete(id: string): Promise<void> {
    console.log('[PENDING USER] Deleted pending user:', id);
  }
}

export default new PendingUserService();
