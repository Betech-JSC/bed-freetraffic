"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = logActivity;
const prisma_1 = __importDefault(require("./prisma"));
/**
 * Ghi nhận một hành động của người dùng vào bảng AuditLog thông qua raw SQL query
 */
async function logActivity(params) {
    try {
        const detailsStr = params.details ? JSON.stringify(params.details) : null;
        await prisma_1.default.$executeRawUnsafe(`INSERT INTO "AuditLog" ("userId", "workspaceId", "action", "ipAddress", "userAgent", "details", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, params.userId, params.workspaceId, params.action, params.ipAddress || null, params.userAgent || null, detailsStr, new Date());
    }
    catch (err) {
        console.error('[AuditLogger] Lỗi lưu audit log:', err);
    }
}
