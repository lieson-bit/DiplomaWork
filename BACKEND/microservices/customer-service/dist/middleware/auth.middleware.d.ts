import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                userType: string;
                email: string;
            };
        }
    }
}
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => void;
export declare const authorizeCustomer: (req: Request, res: Response, next: NextFunction) => void;
export declare const optionalAuthenticate: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map