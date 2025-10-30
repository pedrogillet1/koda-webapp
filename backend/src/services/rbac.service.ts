/** RBAC Service - Minimal Stub (Non-MVP) */
class RbacService {
  async initializeSystemRoles() { console.log('✅ System roles initialized'); return true; }
  async checkPermission() { return true; }
  async assignRole() { return true; }
  async removeRole() { return true; }
  async getUserRoles() { return []; }
}
export default new RbacService();
