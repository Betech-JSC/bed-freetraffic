import prisma from './prisma';

let isInitialized = false;

/**
 * Khởi tạo bảng AuditLog trong cơ sở dữ liệu nếu chưa tồn tại
 */
export async function initAuditLogDb(): Promise<void> {
  if (isInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
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

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AuditLog_workspaceId_idx" ON "AuditLog" ("workspaceId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog" ("userId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog" ("action");
    `);

    isInitialized = true;
    console.log('[AuditLog] Khởi tạo bảng AuditLog thành công.');
  } catch (err) {
    console.error('[AuditLog] Lỗi khởi tạo bảng AuditLog:', err);
  }
}
