import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: any[];
  timestamp: string;
}

export class ResponseUtil {
  static success<T>(
    res: Response,
    data?: T,
    message: string = 'Success',
    statusCode: number = 200
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };
    return res.status(statusCode).json(response);
  }
  
  static error(
    res: Response,
    message: string = 'Internal server error',
    statusCode: number = 500,
    error?: any,
    details?: any[]
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      error: error?.message || error,
      details,
      timestamp: new Date().toISOString()
    };
    return res.status(statusCode).json(response);
  }
  
  static notFound(res: Response, message: string = 'Resource not found'): Response {
    return this.error(res, message, 404);
  }
  
  static badRequest(res: Response, message: string = 'Bad request', error?: any, details?: any[]): Response {
    return this.error(res, message, 400, error, details);
  }
  
  static unauthorized(res: Response, message: string = 'Unauthorized'): Response {
    return this.error(res, message, 401);
  }
  
  static forbidden(res: Response, message: string = 'Forbidden'): Response {
    return this.error(res, message, 403);
  }
  
  static validationError(res: Response, details: any[]): Response {
    return this.badRequest(res, 'Validation failed', undefined, details);
  }
}