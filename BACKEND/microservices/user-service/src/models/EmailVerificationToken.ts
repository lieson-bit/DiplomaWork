// Placeholder for EmailVerificationToken model
export interface EmailVerificationTokenModel {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}