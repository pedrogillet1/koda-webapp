/**
 * SMS Service Stub
 *
 * This service was removed during cleanup. This stub provides no-op implementations
 * to maintain backward compatibility.
 *
 * TODO: Remove usages of this service from auth.service.ts and recoveryVerification.service.ts
 */

/**
 * Format a phone number (stub - returns as-is)
 */
export function formatPhoneNumber(phoneNumber: string): string {
  return phoneNumber;
}

/**
 * Check if a phone number is valid (stub - always returns true)
 */
export function isValidPhoneNumber(_phoneNumber: string): boolean {
  console.warn('[SMS STUB] isValidPhoneNumber called - SMS service is disabled');
  return true;
}

/**
 * Generate a 6-digit SMS code
 */
export function generateSMSCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification SMS (stub - logs warning and returns)
 */
export async function sendVerificationSMS(phoneNumber: string, code: string): Promise<void> {
  console.warn(`[SMS STUB] sendVerificationSMS called - SMS service is disabled`);
  console.warn(`  Phone: ${phoneNumber}, Code: ${code}`);
}

/**
 * Send password reset SMS (stub - logs warning and returns)
 */
export async function sendPasswordResetSMS(phoneNumber: string, code: string): Promise<void> {
  console.warn(`[SMS STUB] sendPasswordResetSMS called - SMS service is disabled`);
  console.warn(`  Phone: ${phoneNumber}, Code: ${code}`);
}

export default {
  formatPhoneNumber,
  isValidPhoneNumber,
  generateSMSCode,
  sendVerificationSMS,
  sendPasswordResetSMS,
};
