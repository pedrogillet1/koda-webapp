/** Brute Force Protection Service - Minimal Stub (Non-MVP) */
class BruteForceProtectionService {
  async checkAttempts(identifier: string) { return { blocked: false, attemptsLeft: 10 }; }
  async recordAttempt(identifier: string, success: boolean) { return true; }
  async resetAttempts(identifier: string) { return true; }
  async unlock(identifier: string) { return true; }
  async getStatistics() { return { totalBlocked: 0, activeBlocks: 0 }; }
}
export default new BruteForceProtectionService();
