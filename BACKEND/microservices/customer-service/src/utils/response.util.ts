import { Response } from 'express';
import { ApiResponse } from '../types';

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
      data
    };
    return res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    message: string = 'Internal server error',
    statusCode: number = 500,
    error?: any
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      error: error?.message || error
    };
    return res.status(statusCode).json(response);
  }

  static notFound(res: Response, message: string = 'Resource not found'): Response {
    return this.error(res, message, 404);
  }

  static badRequest(res: Response, message: string = 'Bad request', error?: any): Response {
    return this.error(res, message, 400, error);
  }

  static unauthorized(res: Response, message: string = 'Unauthorized'): Response {
    return this.error(res, message, 401);
  }

  static forbidden(res: Response, message: string = 'Forbidden'): Response {
    return this.error(res, message, 403);
  }
}