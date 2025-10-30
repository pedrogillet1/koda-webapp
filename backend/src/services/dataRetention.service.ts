/** Data Retention Service - Minimal Stub (Non-MVP) */
class DataRetentionService {
  async applyRetentionPolicy(userId: string) { return true; }
  async scheduleCleanup() { return true; }
  async getRetentionStatus(userId: string) { return { status: 'active', daysRemaining: 365 }; }
}
export default new DataRetentionService();
