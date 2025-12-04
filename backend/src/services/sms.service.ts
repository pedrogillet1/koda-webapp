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

export default {
  sendSMS,
  generateSMSCode,
  verifySMSCode,
};
