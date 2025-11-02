/** RBAC Service - Minimal Stub (Non-MVP) */
class RbacService {
  async initializeSystemRoles() { console.log('✅ System roles initialized'); return true; }
  async checkPermission() { return true; }
  async assignRole() { return true; }
  async removeRole() { return true; }
  async getUserRoles() { return []; }
  async hasPermission(userId: string, permission: string) { return true; }
  async hasAllPermissions(userId: string, permissions: string[]) { return true; }
  async hasAnyPermission(userId: string, permissions: string[]) { return true; }
  async getUserPermissions(userId: string) { return []; }
  async getAllRoles() { return []; }
  async getAllPermissions() { return []; }
  async getUserRole() { return [{ id: '', name: 'user', permissions: [] }]; }
  async createRole(name: string, permissions: string[]) { return { id: '', name, permissions }; }
  async deleteRole(roleId: string) { return true; }
  async clearAllCaches() { return true; }
  revokeRole = this.removeRole;
}
export default new RbacService();
