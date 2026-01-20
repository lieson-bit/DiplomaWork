"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseUtil = void 0;
class ResponseUtil {
    static success(res, data, message = 'Success', statusCode = 200) {
        const response = {
            success: true,
            message,
            data
        };
        return res.status(statusCode).json(response);
    }
    static error(res, message = 'Internal server error', statusCode = 500, error) {
        const response = {
            success: false,
            message,
            error: error?.message || error
        };
        return res.status(statusCode).json(response);
    }
    static notFound(res, message = 'Resource not found') {
        return this.error(res, message, 404);
    }
    static badRequest(res, message = 'Bad request', error) {
        return this.error(res, message, 400, error);
    }
    static unauthorized(res, message = 'Unauthorized') {
        return this.error(res, message, 401);
    }
    static forbidden(res, message = 'Forbidden') {
        return this.error(res, message, 403);
    }
}
exports.ResponseUtil = ResponseUtil;
//# sourceMappingURL=response.util.js.map