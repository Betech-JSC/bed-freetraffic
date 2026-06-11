"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicSpamLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
/**
 * Global rate limiter for standard Dashboard API routes.
 * Limits each IP to 100 requests per minute.
 */
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        error: 'Bạn đang gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.',
    },
});
/**
 * Public spam prevention rate limiter.
 * Limits each IP to 5 requests per minute for sensitive public-facing endpoints
 * (such as form submission, AI chatbot widget message, and public checkout).
 */
exports.publicSpamLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        error: 'Bạn đã gửi yêu cầu quá nhanh. Vui lòng thử lại sau 1 phút.',
    },
});
