// Placeholder for PasswordResetToken model
export interface PasswordResetTokenModel {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}
