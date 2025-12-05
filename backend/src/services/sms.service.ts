/**
 * SMS Service - STUB (service removed)
 * This stub file prevents import errors while the service is removed.
 */

export const sendSMS = async (phoneNumber: string, message: string): Promise<void> => {
  console.log(`[SMS STUB] Would send to ${phoneNumber}: ${message}`);
  // No-op - SMS service removed
};

export const generateSMSCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const verifySMSCode = async (phoneNumber: string, code: string): Promise<boolean> => {
  console.log(`[SMS STUB] Would verify code ${code} for ${phoneNumber}`);
  return false;
};

// Additional stubs for auth.service.ts
export const formatPhoneNumber = (phone: string): string => {
  // Simple pass-through - no actual formatting
  return phone;
};

export const isValidPhoneNumber = (_phone: string): boolean => {
  // Always return true as stub
  return true;
};

export const sendVerificationSMS = async (phoneNumber: string, code: string): Promise<{ success: boolean }> => {
  console.log(`[SMS STUB] Would send verification code ${code} to ${phoneNumber}`);
  return { success: true };
};

export const sendPasswordResetSMS = async (phoneNumber: string, code: string): Promise<{ success: boolean }> => {
  console.log(`[SMS STUB] Would send password reset code ${code} to ${phoneNumber}`);
  return { success: true };
};

export default {
  sendSMS,
  generateSMSCode,
  verifySMSCode,
  formatPhoneNumber,
  isValidPhoneNumber,
  sendVerificationSMS,
  sendPasswordResetSMS,
};
