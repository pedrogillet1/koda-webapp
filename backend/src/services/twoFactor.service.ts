/** Two Factor Authentication Service - Minimal Stub (Non-MVP) */
class TwoFactorService {
  async generateSecret() { return { secret: '', qrCode: '' }; }
  async verifyToken() { return false; }
  async enableTwoFactor() { return false; }
  async disableTwoFactor() { return true; }
}
export default new TwoFactorService();
