"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAuditLogDb = initAuditLogDb;
const prisma_1 = __importDefault(require("./prisma"));
let isInitialized = false;
/**
 * Khởi tạo bảng AuditLog trong cơ sở dữ liệu nếu chưa tồn tại
 */
async function initAuditLogDb() {
    if (isInitialized)
        return;
    try {
        await prisma_1.default.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        "workspaceId" INTEGER NOT NULL,
        "action" TEXT NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "details" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
        CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE
      );
    `);
        await prisma_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AuditLog_workspaceId_idx" ON "AuditLog" ("workspaceId");
    `);
        await prisma_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog" ("userId");
    `);
        await prisma_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog" ("action");
    `);
        isInitialized = true;
        console.log('[AuditLog] Khởi tạo bảng AuditLog thành công.');
    }
    catch (err) {
        console.error('[AuditLog] Lỗi khởi tạo bảng AuditLog:', err);
    }
}
