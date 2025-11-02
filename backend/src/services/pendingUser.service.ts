/** Pending User Service - Minimal Stub (Non-MVP) */
class PendingUserService {
  async createPendingUser(userData: any) {
    // Stub: Would create pending user
    return { id: '', email: '' };
  }
  async getPendingUser(id: string) {
    // Stub: Would get pending user
    return null;
  }
  async deletePendingUser(id: string) {
    // Stub: Would delete pending user
    return true;
  }
}
export default new PendingUserService();
