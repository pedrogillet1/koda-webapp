/** Brute Force Protection Service - Minimal Stub (Non-MVP) */
class BruteForceProtectionService {
  async checkAttempts(_identifier: string) { return { blocked: false, attemptsLeft: 10 }; }
  async recordAttempt(_identifier: string, _success: boolean) { return true; }
  async resetAttempts(_identifier: string) { return true; }
  unlock(_identifier: string, _type?: string) { return true; }
  getStatistics() { return { totalBlocked: 0, activeBlocks: 0 }; }
}
export default new BruteForceProtectionService();
