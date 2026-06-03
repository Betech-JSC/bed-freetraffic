"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_FEATURES = exports.API_VERSION = void 0;
/** Tăng khi đổi API quan trọng — frontend có thể kiểm tra qua GET /api/health */
exports.API_VERSION = '2026-06-03.1';
exports.API_FEATURES = [
    'backlinks-scan',
    'backlinks-crud',
    'schedules-recurrence',
    'reports-pdf-xlsx',
    'email-campaigns',
    'auth-2fa',
];
