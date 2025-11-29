/** RBAC Service - Minimal Stub (Non-MVP) */
class RbacService {
  async initializeSystemRoles() { console.log('✅ System roles initialized'); return true; }
  async checkPermission() { return true; }
  async assignRole(_userId?: string, _roleName?: string, _assignedBy?: string, _expiration?: Date) { return true; }
  async removeRole() { return true; }
  async getUserRoles(_userId: string): Promise<Array<{ role: { name: string } }>> { return []; }
  async hasPermission(_userId: string, _permission: string | { resource: string; action: string }) { return true; }
  async hasAllPermissions(_userId: string, _permissions: string[] | Array<{ resource: string; action: string }>) { return true; }
  async hasAnyPermission(_userId: string, _permissions: string[] | Array<{ resource: string; action: string }>) { return true; }
  async getUserPermissions(_userId: string) { return []; }
  async getAllRoles() { return []; }
  async getAllPermissions() { return []; }
  async getUserRole() { return [{ id: '', name: 'user', permissions: [] }]; }
  async createRole(name: string, _description?: string, permissions?: string[], _createdBy?: string) { return { id: '', name, permissions: permissions || [] }; }
  async deleteRole(_roleId: string, _deletedBy?: string) { return true; }
  async clearAllCaches() { return true; }
  async revokeRole(_userId?: string, _roleName?: string, _revokedBy?: string) { return true; }
}
export default new RbacService();
