// Placeholder for UserSession model
export interface UserSessionModel {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  deviceInfo?: string;
  ipAddress?: string;
  expiresAt: Date;
  createdAt: Date;
}