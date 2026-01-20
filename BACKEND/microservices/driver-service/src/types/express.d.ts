// src/types/express.d.ts
import { JwtPayload } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        userType: string;
      };
    }
  }
}

// This export is needed for TypeScript to treat this as a module
export {};