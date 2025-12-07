/**
 * Pending User Service - STUB (service removed)
 * This stub file prevents import errors while the service is removed.
 */

// Type definition for pending user data
export interface PendingUser {
  email: string;
  passwordHash: string;
  salt: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  recoveryKeyHash: string | null;
  masterKeyEncrypted: string | null;
}

// Stub pending user data for type compatibility
const stubPendingUser: PendingUser = {
  email: '',
  passwordHash: '',
  salt: '',
  firstName: null,
  lastName: null,
  phoneNumber: null,
  emailVerified: false,
  phoneVerified: false,
  recoveryKeyHash: null,
  masterKeyEncrypted: null,
};

export const createPendingUser = async (_data?: any): Promise<PendingUser> => {
  throw new Error('Pending user service removed');
};

export const getPendingUser = async (_email?: string): Promise<PendingUser | null> => null;

export const deletePendingUser = async (_email?: string): Promise<void> => {};

export const verifyPendingUserEmail = async (_email: string, _code: string): Promise<PendingUser> => {
  // Return stub data to satisfy type checking - will throw in real usage
  console.warn('Pending user service has been removed - returning stub data');
  return stubPendingUser;
};

export const verifyPendingUserPhone = async (_email: string, _code: string): Promise<PendingUser> => {
  // Return stub data to satisfy type checking - will throw in real usage
  console.warn('Pending user service has been removed - returning stub data');
  return stubPendingUser;
};

// Alias for backward compatibility
export const verifyPendingEmail = verifyPendingUserEmail;
export const verifyPendingPhone = verifyPendingUserPhone;

// Additional stubs for auth.service.ts
export const resendEmailCode = async (_email: string): Promise<{ success: boolean; pendingUser: PendingUser; emailCode: string }> => {
  return {
    success: true,
    pendingUser: stubPendingUser,
    emailCode: '000000'
  };
};

export const addPhoneToPending = async (_email: string, _phone: string): Promise<{ success: boolean; pendingUser: PendingUser; phoneCode: string }> => {
  return {
    success: true,
    pendingUser: stubPendingUser,
    phoneCode: '000000'
  };
};

export default {
  createPendingUser,
  getPendingUser,
  deletePendingUser,
  verifyPendingUserEmail,
  verifyPendingUserPhone,
  verifyPendingEmail,
  verifyPendingPhone,
  resendEmailCode,
  addPhoneToPending,
};
