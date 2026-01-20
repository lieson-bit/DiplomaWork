import { Response } from 'express';
export declare class ResponseUtil {
    static success<T>(res: Response, data?: T, message?: string, statusCode?: number): Response;
    static error(res: Response, message?: string, statusCode?: number, error?: any): Response;
    static notFound(res: Response, message?: string): Response;
    static badRequest(res: Response, message?: string, error?: any): Response;
    static unauthorized(res: Response, message?: string): Response;
    static forbidden(res: Response, message?: string): Response;
}
//# sourceMappingURL=response.util.d.ts.map