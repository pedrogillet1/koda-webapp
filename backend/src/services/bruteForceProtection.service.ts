/** Brute Force Protection Service - Minimal Stub (Non-MVP) */
class BruteForceProtectionService {
  async checkAttempts(identifier: string) { return { blocked: false, attemptsLeft: 10 }; }
  async recordAttempt(identifier: string, success: boolean) { return true; }
  async resetAttempts(identifier: string) { return true; }
}
export default new BruteForceProtectionService();
