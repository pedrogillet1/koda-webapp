/** Session Management Service - Minimal Stub (Non-MVP) */
class SessionManagementService {
  async createSession() { return null; }
  async validateSession() { return false; }
  async destroySession() { return true; }
  async getUserSessionSummary(userId: string) { return { activeSessions: 0, sessions: [] }; }
  async revokeSession(userId: string, sessionId: string) { return true; }
  async invalidateAllUserSessions(_userId: string, _exceptSessionId?: string) { return 0; }
}
export default new SessionManagementService();
