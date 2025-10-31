/** GDPR Service - Minimal Stub (Non-MVP) */
class GdprService {
  async exportUserData(userId: string) { return {}; }
  async deleteUserData(userId: string) { return true; }
  async getConsent(userId: string) { return { hasConsent: true }; }
  async updateConsent(userId: string, consent: any) { return true; }
}
export default new GdprService();
