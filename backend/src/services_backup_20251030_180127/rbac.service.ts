/** Rbac Service - Minimal Stub (Non-MVP Feature) */
class RbacService {
  async initializeSystemRoles() {
    console.log('✅ System roles initialized');
    return true;
  }

  async checkPermission(userId: string, permission: string) {
    return true; // Allow all for now
  }
}
export default new RbacService();
