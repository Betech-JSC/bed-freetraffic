"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const client_1 = require("@prisma/client");
/**
 * Global Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
    // If headers have already been sent, delegate to default Express handler
    if (res.headersSent) {
        return next(err);
    }
    console.error('🔥 [API Error]:', err);
    // Handle Prisma Client Errors
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2025':
                res.status(404).json({
                    error: 'Không tìm thấy dữ liệu yêu cầu hoặc dữ liệu đã bị xóa trước đó.',
                    code: 'RECORD_NOT_FOUND',
                });
                return;
            case 'P2002':
                const target = err.meta?.target?.join(', ') || '';
                res.status(409).json({
                    error: `Dữ liệu bị trùng lặp. Trường dữ liệu sau đã tồn tại: ${target || 'khóa duy nhất'}.`,
                    code: 'UNIQUE_CONSTRAINT_FAILED',
                    target,
                });
                return;
            case 'P2003':
                res.status(400).json({
                    error: 'Không thể thực hiện thao tác do ràng buộc dữ liệu liên quan (khoá ngoại).',
                    code: 'FOREIGN_KEY_CONSTRAINT_FAILED',
                });
                return;
            case 'P2009':
                res.status(400).json({
                    error: 'Cú pháp truy vấn dữ liệu không hợp lệ hoặc sai định dạng.',
                    code: 'QUERY_VALIDATION_FAILED',
                });
                return;
            default:
                res.status(500).json({
                    error: `Lỗi cơ sở dữ liệu hệ thống: ${err.message}`,
                    code: `DB_ERROR_${err.code}`,
                });
                return;
        }
    }
    if (err instanceof client_1.Prisma.PrismaClientValidationError) {
        res.status(400).json({
            error: 'Dữ liệu gửi lên không đúng định dạng yêu cầu của hệ thống.',
            code: 'VALIDATION_ERROR',
        });
        return;
    }
    // Handle Multer limit or custom file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
            error: 'Kích thước tệp quá lớn. Vui lòng tải lên tệp nhỏ hơn giới hạn cho phép.',
            code: 'LIMIT_FILE_SIZE',
        });
        return;
    }
    if (err.name === 'MulterError') {
        res.status(400).json({
            error: `Lỗi tải lên tệp tin: ${err.message}`,
            code: err.code || 'MULTER_ERROR',
        });
        return;
    }
    // Handle generic error
    const statusCode = err.status || err.statusCode || 500;
    const message = err.message || 'Đã xảy ra sự cố không mong muốn trên hệ thống.';
    res.status(statusCode).json({
        error: message,
        code: err.code || 'INTERNAL_SERVER_ERROR',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
}
/**
 * Route Not Found Middleware (404 for APIs)
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        error: `Đường dẫn API '${req.originalUrl}' không tồn tại.`,
        code: 'ROUTE_NOT_FOUND',
    });
}
